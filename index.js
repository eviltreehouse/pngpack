'use strict';
const { existsSync, readdirSync, statSync } = require('fs');
const { relative, resolve } = require('path');
const debug = require('debug')('pngpack');
const Mapper = require('./lib/mapper');
const Packager = require('./lib/packager');

const DEFAULT_MAX_DIM = 13; // 8192

if (process.argv.length === 2 || process.argv.some(arg => arg.match(/^-h|--help$/))) {
	usage();
	process.exit();
}

const baseDir = process.cwd();

// do argv parsing
let outTextureFile = null;
let outAtlasFile = null;
let inFiles = [];
let maxDimensionPower = DEFAULT_MAX_DIM;
let overwriteMode = false;

const argv = process.argv.slice(2);
while (argv.length > 0) {
	const inarg = argv.shift();
	if (inarg === '-f') {
		overwriteMode = true;
	} else if (inarg === '-m') {
		const v = argv.shift();
		if (Number(v) > 0) {
			maxDimensionPower = closestPowerOf2(v);
		}
	} else if (inarg === '-o') {
		const v = argv.shift();
		if (v) {
			outTextureFile = resolve(v);
			outAtlasFile = `${outTextureFile}.atlas`;
		}
	} else if (inarg === '-i') {
		const v = argv.shift();
		if (v) inFiles.push([v]);
	} else {
		inFiles.push(inarg);
	}
}

// resolve some includes
if (inFiles.some(inf => typeof inf === 'object')) {
	inFiles = resolveIncludes(inFiles);
}

// missing required arguments
if (! outTextureFile || ! outAtlasFile || ! inFiles.length) {
	usage();
	process.exit(1);
}

// ensure we didn't double-include something...
inFiles = [...new Set(inFiles)];

// ensure outfiles don't exist (or overwrite is permitted)
if ((existsSync(outTextureFile) || existsSync(outAtlasFile)) && (! overwriteMode)) {
	console.error(`[!] Cannot overwrite texture/atlas files (specify -f to force)`);
	process.exit(1);
}


const packager = new Packager(baseDir, inFiles);
const recs = packager.sourceRects();
if (! recs.length) process.exit(0);

const m = new Mapper(maxDimensionPower);
if (! m) process.exit(1);

const defn = m.mapRecs(recs);
if (! defn) process.exit(1);
debug('[.] Definition => %O', defn);

packager.package(defn, outTextureFile, outAtlasFile).then((success) => {
	process.exit(success ? 0 : 1);
});

function resolveIncludes(inf) {
	let included = inf.filter(_ => typeof _ === 'string');

	for (const inc of inf.filter(_ => typeof _ === 'object')) {
		const dir = resolve(inc[0]);
		if (! statSync(dir).isDirectory()) {
			console.error(`[!] ${inc[0]} is not a directory`);
			return [];
		}

		const files = readdirSync(dir).filter(f => f.match(/\.png$/i))
			.map(f => relative(baseDir, resolve(dir, f)));
		included.push(...files);
	}

	return included;
}

function usage() {
	console.log('Usage:');
	console.log('  pngpack [-f] [-m <maxDimension>] -o <outFile> [-i <includeDirName>, -i ...] [<...inFileNames>]');
	console.log('  - Final texture will be written to <outFile> with the "atlas" file at <outFile>.atlas');
	console.log('  - "-f" will permit pngpack to override <outFile> and/or your atlas file if they exist');
	console.log(`  - "-m" defines a custom maximum dimension of the resulting texture (default is ${Math.pow(2, DEFAULT_MAX_DIM)}))`);

	console.log();
}

function closestPowerOf2(inv) {
	let power = 0;
	let v = 0;
	while (v <= inv) {
		power++;
		v = Math.pow(2, power);
	}

	return power - 1;
}