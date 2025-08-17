#!/bin/sh

set -e

sed -i '/@react-native-google-signin\/google-signin/d' package.json
sed -i '/@react-native-google-signin\/google-signin/d' app.config.ts
rm lib/supabase/auth.native.ts
