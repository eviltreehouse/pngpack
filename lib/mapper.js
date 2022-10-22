'use strict';
const debug = require('debug')('pngpack');

/** @typedef {import('./src-rect')} SourceRect */
/** @typedef {[number,number]} Coord */
/** @typedef {{offset: Coord, size: Coord}} MapItem */
/** @typedef {{size: Coord, contents: Object.<string,MapItem>} MapDefinition */

const squarePower = (p) => Math.pow(2, p);
const sizeInBlocks = (v, blkSize) => Math.ceil(v / blkSize);

const sortRecsByGeometry = (a, b) => {
	const al = Math.max(a.w, a.h);
	const bl = Math.max(b.w, b.h);
	if (al === bl) return 0;
	return (al > bl) ? 1 : -1;
};

const greatestCommonDivisor = (a, b) => {
	let gcd = 1;

	for (let i = 1; i <= a && i <= b; i++) {
		if ((a % i === 0) && (b % i === 0)) {
			gcd = i;
		}
	}

	return gcd;
}

const greatestCommonDivisorMulti = (...ns) => {
	debug('Dimensions for all source images: %o', ns);
	const getGcd = (a, b) => {
		return (a === 0) ? b : getGcd(b % a, a);
    }

	let gcd = ns[0];

	for (let i = 1; i < ns.length; i++) {
		gcd = greatestCommonDivisor(ns[i], gcd);

		if (gcd === 1) {
			return 1;
		}
	}

	return gcd;
}


class Mapper {
	/**
	 * @param {number} maxOrder
	 */
	constructor(maxOrder) {
		this.blockSize = 1; // we'll figure out a better one once we know the sizes coming in
		this.maxOrder = Number(maxOrder);
	}

	/**
	 * @param {SourceRect[]} rs
	 * @return {MapDefinition}
	 */
	mapRecs(rs) {
		let xOrder = 1;
		let yOrder = 1;

		let done = false;
		let complete = false;

		/** @type {MapDefinition} */
		let defn;

		let _map = null;

		// use the `Set` construct to "wash" out duplicates for calculation performance
		const allDimsUnique = new Set(
			[].concat(
				...rs.map(r => r.w),
				...rs.map(r => r.h)
			)
		);

		this._calculateBlockSize([...allDimsUnique]);

		// sort rects (and then descend them)
		rs = rs.sort(sortRecsByGeometry);
		rs.reverse();

		// keep track of IDs so definition is clearer
		// and quickly check that all our tags are unique
		const rectIds = rs.map(r => r.tag);
		if (rectIds.length !== [...new Set(rectIds)].length) {
			console.error('[!] All source tags must be unique!');
			return null;
		}

		while (! done) {
			// clear definition
			defn = { contents: {}, size: [] };

			if (! _map) {
				this.mapX = squarePower(xOrder);
				this.mapY = squarePower(yOrder);
				if (this.mapX < this.blockSize || this.mapY < this.blockSize) {
					// we need to be at least 1x1 blocks :)
					if (xOrder === yOrder) xOrder++;
					else yOrder++;

					continue;
				}

				debug('[.] Creating %dx%d map...', this.mapX, this.mapY);

				_map = this._newMap(this.mapX, this.mapY);
				defn.size = [this.mapX, this.mapY];
			}

			let rectId = -1;

			let aborted = false;
			for (const r of rs) {
				rectId++;
				const rectFit = this._fitSourceRect(_map, r);

				if (rectFit === null) {
					// discard map, adjust map dims and try again...
					debug('[?] Cannot fit #%d into %dx%d...trying with larger dimensions', rectId, this.mapX, this.mapY);
					if (xOrder === yOrder) xOrder++;
					else yOrder++;

					if (xOrder > this.maxOrder) {
						console.log('[!] Cannot find a suitable map within maximum allowed dimensions');
						done = true;
					}

					aborted = true;
					_map = null;
					break;
				} else {
					debug('[.] setting #%d into %o.', rectId, rectFit);
					this._markMap(_map, rectId, r, rectFit);

					// convert back to pixels
					const itemKey = rectIds[rectId];
					const item = {
						offset: rectFit.map(bs => bs * this.blockSize),
						size: [r.w, r.h],
					};

					defn.contents[itemKey] = item;
				}
			}

			if (! aborted) {
				complete = true;
				done = true;
			}
		}

		return complete ? defn : null;
	}

	/**
	 * @param {number[]} allSrcDimensions
	 * @return {void}
	 */
	_calculateBlockSize(dims) {
		const gcd = greatestCommonDivisorMulti(...dims);
		debug('[.] Mapping block size: %d', gcd);
		this.blockSize = gcd;
	}

	/**
	 *
	 * @param {number[][]} map
	 * @param {number} x
	 * @param {number} y
	 * @param {number} bx
	 * @param {number} by
	 */
	_checkFit(map, x, y, bx, by) {
		const maxx = map[0].length;
		const maxy = map.length;

		// no way it can fit...
		if ((x + bx) > maxx || (y + by) > maxy) return false;

		let fit = true;
		// lets see if anythings in the way
		for (let yy = 0; yy < by; yy++) {
			for (let xx = 0; xx < bx; xx++) {
				if (map[y+yy][x+xx] !== null) {
					fit = false;

					break;
				}
			}

			if (!fit) break;
		}

		return fit;
	}

	/**
	 * @param {number[][]} map
	 * @param {SourceRect} r
	 * @return {number[]|null}
	 */
	_fitSourceRect(map, r) {
		const rbs = r.sizeBlocks(this.blockSize);

		if (rbs[1] > map.length || rbs[0] > map[0].length) return null;

		let fit = null;
		for (let y = 0; y < map.length; y++) {
			for (let x = 0; x < map[0].length; x++) {
				if (this._checkFit(map, x, y, rbs[0], rbs[1])) {
					fit = [x, y];
					break;
				}
			}

			if (fit) break;
		}

		return fit === null ? null : fit;
	}

	/**
	 * @param {number[][]} _map
	 * @param {number} id
	 * @param {SourceRect} sr
	 * @param {number[]} fit
	 * @return {void}
	 */
	_markMap(_map, id, sr, fit) {
		const geom = sr.sizeBlocks(this.blockSize);
		for (let y = 0; y < geom[1]; y++) {
			for (let x = 0; x < geom[0]; x++) {
				_map[fit[1]+y][fit[0]+x] = id;
			}
		}
	}

	/**
	 * @param {number} sx
	 * @param {number} sy
	 * @return {number[][]}
	 */
	_newMap(sx, sy) {
		const bsx = sizeInBlocks(sx, this.blockSize);
		const bsy = sizeInBlocks(sy, this.blockSize);

		let _map = new Array(bsy);
		for (let i = 0; i < _map.length; i++) {
			_map[i] = new Array(bsx);
			_map[i].fill(null);
		}

		return _map;
	}
}

module.exports = Mapper;