# Installation

Here you will find instructions to install NouTube.

## Prerequisites

- [bun](https://bun.com/docs/installation)
- [Android SDK](https://developer.android.com/studio): if you want to build the android app
- [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent): if you want to use Expo Go on your phone

## Installing the project

- Clone the project:

```shell
git clone https://github.com/nonbili/NouTube.git 
```

- Install all dependencies:

```shell
bun install
```

- Build in dev mode:

```shell
bun dev
```

- Build the android app:

```shell
bun android
```

## Troubleshooting

### "Failed to resolve the Android SDK path..."

Make sure that you have the android SDK installed and the environment variable set with the SDK location.

```shell
export ANDROID_HOME=/home/john/Android/sdk
```
