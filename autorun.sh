#!/bin/sh

DestDir=d

rm -rf $DestDir
mkdir -p $DestDir
cd $DestDir

git clone --depth=2 --branch=master git@github.com:songchenwen/zhuanlan-rss.git .

DATE=$(date +"%Y-%m-%d-%H-%M-%S")
echo $DATE > update_trigger.txt

git config --global push.default simple
git config --global user.name 'songchenwen'
git config --global user.email emptyzone.0@gmail.com
git add -A
git commit -m 'trigger update'
git push
