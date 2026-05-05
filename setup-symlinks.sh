#!/bin/bash

folders=("http" "aws" "middlewares" "grpc")

cd ./src/core
yarn link


for folder in "${folders[@]}"; do
    cd "../$folder"
    if [[ "$folder" != "grpc" ]]; then
        yarn link "@heliosjs/core"
    fi

done
