'use strict';

class SrcRect {
	/**
	 * @param {number} w 
	 * @param {number} h 
	 * @param {string} tag
	 */
	constructor(w, h, tag) {
		this.w = w || 0;
		this.h = h || 0;
		this.tag = tag;
	}

	/**
	 * @param {number} blockSize
	 * @return {[number, number]}
	 */
	sizeBlocks(blockSize) {
		blockSize = blockSize || 1;
		return [
			Math.ceil(this.w / blockSize),
			Math.ceil(this.h / blockSize),
		];
	}
}

module.exports = SrcRect;