#!/bin/bash
token=$(grep token /etc/drumee/credential/smsfactor/sms.json | sed -e "s/\"token\":\"//" | sed -e "s/\"$//")
text=$1
to=$2
sender='Drumee_Monitor'

curl -H "Authorization: Bearer $token" -H "Accept: application/json" -X GET "https://api.smsfactor.com/send?text=$text&to=$to&sender=$sender"
