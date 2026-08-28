#!/usr/bin/bash

script_dir="$(dirname "$(readlink -f "$0")")"

if [ -f /etc/drumee/drumee.sh ]; then
  source /etc/drumee/drumee.sh
fi

# DEST_DIR is the location where your local changes will be synced to 
# It's possible to run several Drumee Intances (endpoints) on a same machine. 
# Keep ENDPOINT=main unless you ahe created a diffrent
# export ENDPOINT=main

# Syncing changes on remote server
# Ensure that you have proper creadentials to access remote filesystem
# export DEST_HOST=example.org 
# export DEST_USER=$USER

# Syncing changes on a local Docker container
# export CONTAINER_NAME

# This is the default setup that matches the Docker Compose file from
# https://github.com/drumee/documentation/blob/main/templates/docker/devel-template.yaml
# export CONTAINER_NAME=perdrix
# export DEST_DIR=${HOME}/.config/${CONTAINER_NAME}/server

# Syncing changes on a local host
# export DEST_DIR=$HOME/.config/Drumee/
# export DEST_DIR=$(dirname "$script_dir/..")/build
