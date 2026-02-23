#!/bin/bash
apt-get update && apt-get install -y ffmpeg
node server/convert.cjs
