'use strict';
const { createReadStream, readFileSync, writeFileSync } = require('fs');
const { resolve, sep } = require('path');
const { PNG } = require('pngjs');
const debug = require('debug')('pngpack');

/** @typedef {import('./mapper').MapDefinition} MapDefinition */

const SrcRect = require('./src-rect');

class Packager {
	/**
	 * @param {string} baseDir
	 * @param {string[]} inFiles 
	 * @param {string} outFile 
	 */
	constructor(baseDir, inFiles, outFile) {
		this.baseDir = baseDir;
		this.inFiles = inFiles;
		this.outFile = outFile;
		this.atlasFile = outFile + ".atlas"; /** @fixme */

		this.fileTags = {};
		this.tagFiles = {};

		// create ref tables
		for (let inf of inFiles) {
			const tag = inf.replace(this.baseDir + sep, '');
			this.fileTags[inf] = tag;
			this.tagFiles[tag] = inf;
		}
	}

	/**
	 * @param {MapDefinition} defn 
	 * @return {Promise<boolean>}
	 */
	package(defn) {
		try {
			const png = new PNG({ width: defn.size[0], height: defn.size[1] });
			const blits = [];

			// stitch everything together
			for (let tag in defn.coords) {
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
								const tx = defn.coords[tag][0];
								const ty = defn.coords[tag][1];
								this.bitblt(png, 0, 0, this.width, this.height, tx, ty);
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
				debug('Writing texture to %s', this.outFile);
				writeFileSync(this.outFile, PNG.sync.write(png));
			
				// write atlas
				debug('Writing atlas to %s', this.atlasFile);
				writeFileSync(this.atlasFile, JSON.stringify(defn.coords, null, 2));
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

/**
 * @todo define a better argument protocol
 * @param {string} baseDir 
 * @param {string[]} argv 
 * @return {Packager}
 */
Packager.FromArgv = function(baseDir, argv) {
	const files = argv.slice(2);
	const outFile = resolve(files.shift());
	const inFiles = [...files].map(f => resolve(f));
	
	return new Packager(baseDir, inFiles, outFile);
};

/**
fs.createReadStream("in.png")
  .pipe(new PNG())
  .on("parsed", function () {
    this.bitblt(dst, 0, 0, 100, 50, 0, 0);
    dst.pack().pipe(fs.createWriteStream("out.png"));
  });
*/

module.exports = Packager;