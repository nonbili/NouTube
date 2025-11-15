# Contributing

Thank you for your interest in contributing to [NouTube](https://github.com/nonbili/NouTube) !

Please read this guide before submitting changes.

## Before you start

Knowledge of JavaScript/TypeScript, React and ReactNative makes it easier to contribute to the project.

## Installation

Here you will find instructions to install NouTube.

### Prerequisites

- [bun](https://bun.com/docs/installation)
- [Android SDK](https://developer.android.com/studio): if you want to build the android app
- [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent): if you want to use Expo Go on your phone

### Installing the project

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

### Troubleshooting

#### "Failed to resolve the Android SDK path..."

Make sure that you have the android SDK installed and the environment variable set with the SDK location.

```shell
export ANDROID_HOME=/home/john/Android/sdk
```

## Pull requests

1. Use a dedicated branch for your work.
2. Ensure that your code passes the lint check.
3. Maintainers may request changes before merging.

## Style guidelines

### Commits

Your commits must:

- Be meaningful
- Refer the issue (if you are fixing an issue)

Example: android(0.4.3): support sponsor block, fix #7

## Labels

Prefix your issues and PRs with labels to indicate their type such as:
`[bug]`, `[enhancement]`, `[question]` etc...
