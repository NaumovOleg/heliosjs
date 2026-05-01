#!/bin/bash


cd ./src/core
yarn link
ln -sf ../../README.md ./

cd ../http
yarn link @heliosjs/core
ln -sf ../../README.md ./

cd ../aws
yarn link @heliosjs/core
ln -sf ../../README.md ./

cd ../middlewares
yarn link @heliosjs/core
ln -sf ../../README.md ./

cd ../grpc
ln -sf ../../README.md ./
