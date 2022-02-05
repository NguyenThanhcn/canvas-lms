BASEDIR=$(dirname "$0")
echo "$BASEDIR"
cd $BASEDIR/../log
rm delayed_job.log.*
rm production.log.*
