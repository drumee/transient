#!/bin/bash

# reload after deployment
if [ "$ENDPOINT" = "" ]; then
  echo Nothing to run after deploy
else
  if [ "$DEST_HOST" = "" ]; then
    sudo drumee start $ENDPOINT
  else
    if [ "$DEST_USER" = "" ]; then
      ssh $DEST_HOST sudo drumee start $ENDPOINT
    else
      ssh $DEST_USER@$DEST_HOST sudo drumee start $ENDPOINT
    fi
  fi
fi