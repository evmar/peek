#!/bin/sh

set -e

npm run build
mkdir -p deploy
cp src/{bundle.js,index.html,style.css} deploy
