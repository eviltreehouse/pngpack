'use strict';
const { createReadStream, readFileSync, writeFileSync } = require('fs');
const { relative } = require('path');
const { PNG } = require('pngjs');
const debug = require('debug')('pngpack');

/** @typedef {import('./mapper').MapDefinition} MapDefinition */

const SrcRect = require('./src-rect');

class Packager {
	/**
	 * @param {string} baseDir
	 * @param {string[]} inFiles
	 */
	constructor(baseDir, inFiles) {
		this.baseDir = baseDir;
		this.inFiles = inFiles;

		this.fileTags = {};
		this.tagFiles = {};

		// create ref tables
		for (let inf of inFiles) {
			const tag = relative(this.baseDir, inf);
			this.fileTags[inf] = tag;
			this.tagFiles[tag] = inf;
		}
	}

	/**
	 * @param {MapDefinition} defn
	 * @param {string} outTextureFile
	 * @param {string} outAtlasFile
	 * @return {Promise<boolean>}
	 */
	package(defn, outTextureFile, outAtlasFile) {
		try {
			const png = new PNG({ width: defn.size[0], height: defn.size[1] });
			const blits = [];

			// stitch everything together
			for (let tag in defn.contents) {
				let f = this.tagFiles[tag];
				if (! f) throw new Error('Lost ' + tag);

				const p = new Promise(resolve => {
					const scopedTag = tag;
					const scopedF = f;
					debug('Processing %s: %s', scopedTag, scopedF);

					try {
						const st = createReadStream(scopedF)
						.pipe(new PNG())
						.on('error', function(err) {
							console.error('[!] Packaging failed reading', scopedTag, err.message);
							resolve(false);
						})
						.on('parsed', function() {
							debug('[.] stitching %s', scopedTag);
							try {
								const src = defn.contents[tag];
								const destX = src.offset[0];
								const destY = src.offset[1];
								this.bitblt(png, 0, 0, this.width, this.height, destX, destY);
								resolve(true);
								st.end();
							} catch(err) {
								console.error(err);
								resolve(false);
								st.end();
							}
						});
					} catch(err) {
						console.error('[!] Packaging failed on stitching', scopedTag, err.message);
						resolve(false);
					}
				});

				blits.push(p);
			}

			const final = blits.reduce((chain, cur) => {
				return chain.then(succ => {
					return cur.then(res => [...succ, res])
				});
			}, Promise.resolve([]));

			return final.then(results => {
				if (results.some(r => r === false)) {
					debug('[?] Results => %o', results);
					return false;
				}

				// write final texture
				debug('Writing texture to %s', outTextureFile);
				writeFileSync(outTextureFile, PNG.sync.write(png));

				// write atlas
				debug('Writing atlas to %s', outAtlasFile);
				writeFileSync(outAtlasFile, JSON.stringify(defn.contents, null, 2));
				return true;
			});
		} catch(err) {
			console.error('Failed to package: ' + err.message);
			return Promise.resolve(false);
		}
	}

	/**
	 * @return {SrcRect[]}
	 */
	sourceRects() {
		const recs = [];
		for (let inf of this.inFiles) {
			try {
				const tag = this.fileTags[inf];
				if (! tag) throw new Error('Failed to tag file');

				const png = PNG.sync.read(readFileSync(inf));
				const r = new SrcRect(png.width, png.height, tag);

				recs.push(r);
			} catch(err) {
				console.error(`[!] Failed to read ${inf}... Skipping (${err.message})`);
			}
		}

		return recs;
	}
}

module.exports = Packager;