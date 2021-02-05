'use strict';
const debug = require('debug')('pngpack');
const Mapper = require('./lib/mapper');
const Packager = require('./lib/packager');

const baseDir = process.cwd();
const packager = Packager.FromArgv(baseDir, process.argv);
const recs = packager.sourceRects();
if (! recs.length) process.exit(0);

const m = new Mapper(16, 9);
if (! m) process.exit(1);

const defn = m.mapRecs(recs);
if (! defn) process.exit(1);
debug('[.] Definition => %O', defn);

packager.package(defn).then((success) => {
	process.exit(success ? 0 : 1);
});