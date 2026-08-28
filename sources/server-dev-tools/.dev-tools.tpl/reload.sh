#!/bin/bash
if [ "$DONT_RELOAD" != "" ]; then
  echo Reload intentionnaly skipped
  exit 0
fi
# reload after sync/deployment
if [ "$ENDPOINT" = "" ]; then
  echo Nothing to run after deploy
else
  if [ "$CONTAINER_NAME" != "" ]; then
     if [ "$DEST_HOST" = "" ]; then
      sudo docker exec $CONTAINER_NAME drumee start $ENDPOINT
      sudo docker exec $CONTAINER_NAME drumee start $ENDPOINT/service
    else
      if [ "$DEST_USER" != "" ]; then
        ssh $DEST_USER@$DEST_HOST sudo docker exec $CONTAINER_NAME drumee start $ENDPOINT
        ssh $DEST_USER@$DEST_HOST sudo docker exec $CONTAINER_NAME drumee start $ENDPOINT/service
      else 
        echo Require DEST_USER to update remote
      fi
    fi
  else
    if [ "$DEST_HOST" = "" ]; then
      sudo drumee start $ENDPOINT
      sudo drumee start $ENDPOINT/service
    else
      if [ "$DEST_USER" = "" ]; then
        ssh $DEST_HOST sudo drumee start $ENDPOINT
        ssh $DEST_HOST sudo drumee start $ENDPOINT/service
      elif [ "$CONTAINER_NAME" != "" ]; then
        sudo docker exec $CONTAINER_NAME drumee start $ENDPOINT
        sudo docker exec $CONTAINER_NAME drumee start $ENDPOINT/service
      else
        ssh $DEST_USER@$DEST_HOST sudo drumee start $ENDPOINT
        ssh $DEST_USER@$DEST_HOST sudo drumee start $ENDPOINT/service  
      fi
    fi
  fi
fi