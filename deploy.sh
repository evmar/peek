#!/bin/sh

set -e

mkdir -p deploy
npm run build
cp src/{index.html,style.css} deploy
