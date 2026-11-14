#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if [[ -x "$PWD/.local/runtime/node_modules/node/bin/node" ]]; then
  export PATH="$PWD/.local/runtime/node_modules/node/bin:$PATH"
fi
npm run start:demo
if [[ $? -ne 0 ]]; then
  read "reply?启动失败，查看上方提示。按回车关闭…"
fi
