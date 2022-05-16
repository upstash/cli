

fmt: clean
	deno fmt
	deno lint


clean:
	rm -rf dist

build-node: fmt
	deno --unstable run -A ./cmd/build.ts


build-bin: fmt
	deno --unstable \
		compile \
		--allow-env \
		--allow-read \
		--allow-write \
		--allow-net \
		--output=./bin/upstash\
		 ./src/mod.ts

