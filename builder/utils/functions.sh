
check_status() {
  if [ "$1" != "0" ]; then
    echo " -------------------------------------------" 1>&2
    echo " $2 did not succeed, aborting" 1>&2
    echo " -------------------------------------------" 1>&2
    exit 1
  fi
}

answer() {
  stdin="${1:-/dev/stdin}"
  while read line; do
    break
  done <$stdin
  echo $line
}

get_version() {
  base=$1
  type=$2
  if [ "$type" = "" ]; then
    changelog="${base}/debian/changelog"
  else
    changelog="${base}/$type/debian/changelog"
  fi
  version=$(head -1 $changelog | awk -F'[()]' '{print $2}')
  echo $version
}

get_email() {
  base=$1
  type=$2
  if [ "$type" = "" ]; then
    changelog="${base}/debian/changelog"
  else
    changelog="${base}/$type/debian/changelog"
  fi
  email=$(egrep '<.+>' $changelog | head -1 | awk -F'[<>]' '{print $2}')
  echo $email
}


get_build_dir() {
  build_dir=$1
  rm -rf $build_dir
  mkdir -p $build_dir
  echo $build_dir
}

check_version() {
  version=$1
  control=$2
  if [ ! -f $control ]; then
    echo "Could not find control file $control"
    exit 1
  fi

  current=$(grep Standards-Version $control | awk '{print $2}')
  # echo -n "Current version is $current."

  if [ "$version" == "" ]; then
    echo -n "Rebuild current version [$current]? "
    version=$(answer)
    if [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
      echo "Will be building version=$version"
    else
      if [ "$version" == "" ]; then
        version=$current
      else
        echo "Version must be in the format X.Y.Z"
        exit 1
      fi
    fi
  fi
  if [ "$version" != "$current" ]; then
    sed -i -E "s/Standards-Version: (.+)$/Standards-Version: $version/" $control
  fi
  export version=$version
}

check_email() {
  email=$1
  control=$2
  if [ ! -f $control ]; then
    echo "Could not find control file $control"
    exit 1
  fi

  current=$(grep Maintainer $control | sed -e "s/^.* <//" | sed -e "s/>.*$//")
  # echo -n "Current maintainer is $current. "

  if [ "$email" == "" ]; then
    echo -n "Use current maintainer [$current]? "
    email=$(answer)
    if [[ $email =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$ ]]; then
      echo "Will be building with maintainer=$email"
    else
      if [ "$email" == "" ]; then
        email=$current
      else
        echo "Invalid email <$email>"
        exit 1
      fi
    fi
  fi
  if [ "$email" != "$current" ]; then
    echo -n "Enter new maintainer's name: "
    name=$(answer)
    sed -i -E "s/Maintainer: (.+)$/Maintainer: $name <$email>/" $control
  fi
  export email=$email
}

check_build_dir() {
  build_dir=$1
  if [ -d $build_dir ]; then
    if [ "$force" == "rebuild" ]; then
      echo "Rebuilding existing $build_dir"
      rm -rf $build_dir
    else
      echo "$build_dir already exists"
      echo "- delete existing source and rebuild all: 1"
      echo "- keep existing source and rebuild from it: 2"
      echo -n "[1] : "
      r=$(answer)
      if [ "$r" == "1" -o "$r" == "" ]; then
        echo "Removing $build_dir"
        rm -rf $build_dir
      else
        if [ "$r" == "2" ]; then
          echo "Keeping $build_dir"
        else
          echo "Unexpected selection"
          exit 1
        fi
      fi
    fi
  fi
  mkdir -p $build_dir/
  export build_dir=$build_dir
}

strip_base(){
  base=$1
  str=$2
  p=$(echo $base | sed -e "s/\//\./g")
  echo $str | sed -e "s/$p//" | sed -e "s/^\/+//"
}

#
bundle() {
  base=$1
  name=$2
  branch=$3
  src_files=$4
  dest_base=$5
  run=$6
  if [ "$REPO_BASE" = "" ]; then
    repo=git@gitlab.drumee.in:drumee/$name.git
  else 
    repo=${REPO_BASE}/${name}.git
  fi
  src_dir=${base}/src/$name
  if [ -d $src_dir/.git ]; then
    echo "Updating existing $name source in $src_dir"
    cd $src_dir
    git stash
    git pull origin $branch
    git checkout $branch
  else
    rm -rf $src_dir
    echo "Fetching $name source from $repo into $src_dir"
    mkdir -p ${base}/src
    cd ${base}/src
    git clone -b $branch $repo
    cd $src_dir
  fi
  if [ -f package.json ]; then
    npm i
    # set +e
    # npm audit fix
    if [ "$run" != "" ]; then
      npm run $run
    fi
    # set -e
  fi

  if [ "$dest_base" != "" ]; then
    target=$build_dir/files/$dest_base
    mkdir -p $target
    echo "---------------------------------------------------------------"
    echo "Bundling component $name "
    echo "FROM : " $(strip_base $base $src_dir/$src_files)
    echo "TO   : " $(strip_base $base $target)
    echo "---------------------------------------------------------------"
    # echo rsync --delete-before --exclude=.git -ar $src_dir/$src_files $target/
    rsync --delete-before --exclude=.npmrc --exclude=.git -ar $src_dir/$src_files $target/
  else
    echo "Skip target, since it's undefined"
  fi
  echo "DONE $src_dir/$src_files"
}

bundle_acme(){
  base=$1
  dest_base=$2
  src_dir=${base}/src
  mkdir -p $src_dir
  cd $src_dir
  rm -rf acme
  acme_dir=$src_dir/acme
  git clone https://github.com/acmesh-official/acme.sh.git acme 
  mkdir -p $acme_dir/configs
  mkdir -p $acme_dir/certs
  target=$build_dir/files/$dest_base
  mkdir -p $target
  echo "---------------------------------------------------------------"
  echo "Bundling component $name "
  echo "FROM : " $(strip_base $base $src_dir/$src_files)
  echo "TO   : " $(strip_base $base $target)
  echo "---------------------------------------------------------------"
  rsync --delete-before --exclude=.git -ar $acme_dir/ $target/
}

bundle_schmas_patches(){
  base=$1
  src=$2
  manifest=$3
  dest=$4
  rm -rf $dest
  cd "$base"
  for i in $(cat $manifest); do
    echo $i
    dir=$(dirname $i)
    target="$dest/$dir"
    if [ ! -d $target ]; then
      mkdir -p $target
    fi 
    src_file="$src/$i"
    if [ -f $src_file ]; then
      cp $src_file $target
    fi
  done
  cp $manifest $dest
}

parse_args(){
  for arg in "$@"; do
    case $arg in
    --version=*)
      version="${arg#*=}"
      export version=$version
      shift
      ;;
    --force=*)
      force="${arg#*=}"
      export force=$force
      shift
      ;;
    --type=*)
      type="${arg#*=}"
      export type=$type
      shift
      ;;
    --compile=*)
      compile="${arg#*=}"
      export compile=$compile
      shift
      ;;
    --enable-api=*)
      enableApi="${arg#*=}"
      export enableApi=$enableApi
      shift
      ;;
    --email=*)
      email="${arg#*=}"
      export email=$email
      shift
      ;;
    esac
  done

}

copyToTarget(){
  src=$1
  if [ -d "$DEB_BUILD_TARGET" ]; then
    echo Copying "$src" to $DEB_BUILD_TARGET
    cp "${src}_all.deb" "${DEB_BUILD_TARGET}"
  fi
}
