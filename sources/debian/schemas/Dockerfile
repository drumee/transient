FROM debian:latest

# System packages and dependencies
RUN apt-get update
RUN apt-get install -y build-essential net-tools g++ apt-utils gpg gnupg2 apt-transport-https curl inotify-tools wget lsb-release ca-certificates dialog Dockerfile

# MariaDb
# RUN curl -sS https://downloads.mariadb.com/MariaDB/mariadb_repo_setup | bash
RUN apt-get update
RUN apt-get install -y --no-install-recommends mariadb-server mariadb-client mariadb-backup


