# pngpack: Lightweight PNG atlas packer

I needed a tool to be able to repeatedly repack my PNG files into a single atlas that I could work into my "build" pipeline: so I built one :)

`pngpack` takes a bunch of PNGs, figures out their dimensions, then tries to fit them into a single texture with power-of-2 dimensions to ensure maximum performance on the GPU. Essentially it will keep iterating with different target sizes (2x2, 4x2, 4x4, etc.) until it finds one that will fit everything.

## Installation
```sh
# For Node.js gamedev projects, install `pngpack` as a dev dependency:
$ npm i -D eviltreehouse/pngpack

# For general purpose, install it globally:
$ npm i -g eviltreehouse/pngpack
```

## Usage
```sh
# Get usage help
$ pngpack -h

# Take my three textures and merge them into main.png
$ pngpack -o main.png sheet1.png sheet2.png sheet3.png

# By default, `pngpack` won't overwrite your output file if
# it exists, use `-f` to override this behavior (useful for
# build pipelines.)
$ pngpack -f -o main.png ...

# Take all my textures for various dirs and merge them into 
# main.png: (you can use any combination of dirs and files.)
$ pngpack -o main.png \
  -i assets/textures \
  -i assets/fontmaps \
  assets/logo.png assets/titlescreen.png ...

#
# ADVANCED SETTINGS:
#

# By default it will keep resizing up the output texture
# until it finds one that fits. If you have a specific
# need to limit the size, you can provide a maximum
# dimension. It will error out if its unable to massage
# all the textures within that space.
$ pngpack -m 1024 ... # 1024x1024 maximum

# pngpack will try to determine a "block size" to work
# out the best fit based on the geometry of the inbound
# textures (effectively the highest common factor.)
# If you have odd-sized textures, you might want to 
# specify a size manually for speed...
$ pngpack -b 32 ... # Work out fit in 32x32 blocks

#
# OUTPUT
#

# You will have two output files, one if your merged 
# texture, the other is the "atlas" which is simple 
# JSON describing the x/y of the sub-textures.
$ ls | grep main
main.png main.png.atlas
$ cat main.png.atlas
{
	"assets/textures/sprites0.png": [0, 0],
	"assets/textures/sprites1.png": [256, 0],
	"assets/textures/logo.png": [256, 128],
	...
}

```


## More Info
- Support for Node 10+
- `PNG` is the only supported format. Output texture will be in `colorType: 6 (RGBA)` regardless of the settings for your input files.
- The fitting algorithms are pretty basic: merging dozens of textures might take a bit of time depending on your CPU, the geometry complexity, etc. It does identify the optimal "block size" based on the sizes of all your inbound textures to try to optimize its operation so the more similar they are, the faster they will run.
- The atlas tags are based off of the working directory when the program is ran: you can `cd` into a deeper directory if you want to shorten them down, e.g.:
```sh
$ cd assets && pngpack -f -o ../main.png ...
```

## Potential Future Features
- Custom tagging instead of just the sub-texture filename.
- Exclusion of files from an `-i <dir>` include.
- Sub-atlas coordinates in the atlas (e.g. list the x/y for each specific cell within a spritesheet texture)


## Feature History

**Version 0.2.0**
- Support for directory parsing with `"-i"`, and cleaner atlas spec.
- Automatic block size calculation.
- Changing default behavior to prevent accidently overwriting an output file an a CLI flag to enable it: `"-f"`.

**Version 0.1.0**
- Initial version with baseline functionality.

## License
MIT: see `LICENSE.md`