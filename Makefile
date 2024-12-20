

fmt: clean
	deno fmt
	deno lint


clean:
	rm -rf dist

build-node: fmt
	deno run -A ./cmd/build.ts


build-bin: fmt
	deno compile \
		--allow-env \
		--allow-read \
		--allow-write \
		--allow-net \
		--output=./bin/upstash\
		 ./src/mod.ts

