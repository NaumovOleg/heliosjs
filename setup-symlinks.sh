#!/bin/bash

folders=("http" "aws" "middlewares" "grpc")

cd ./src/core
yarn link
ln -sf ../../README.md ./
ln -sf ../../symlinks/tsconfig.build.json ./
ln -sf ../../symlinks/tsconfig.json ./
cd -  

for folder in "${folders[@]}"; do
    cd "./src/$folder"
    if [[ "$folder" != "grpc" ]]; then
        yarn link "@heliosjs/core"
    fi
    rm -f README.md tsconfig.build.json tsconfig.json
    ln -sf ../../README.md ./
    ln -sf ../../symlinks/tsconfig.build.json ./
    ln -sf ../../symlinks/tsconfig.json ./
    cd - 
done
