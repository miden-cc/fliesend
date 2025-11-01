#!/bin/bash

# fließend テスト用フォルダ作成スクリプト
# このスクリプトは、fließendの動作確認用のサンプルフォルダ構造を作成します

echo "🗂️  fließend テスト用フォルダを作成します..."

# テストフォルダのパス
TEST_DIR="$HOME/fliesend-test"

# 既存のテストフォルダがあれば確認
if [ -d "$TEST_DIR" ]; then
  read -p "⚠️  $TEST_DIR は既に存在します。削除して再作成しますか? (y/N): " confirm
  if [[ $confirm == [yY] ]]; then
    rm -rf "$TEST_DIR"
    echo "✅ 既存のフォルダを削除しました"
  else
    echo "❌ キャンセルしました"
    exit 0
  fi
fi

# フォルダ構造の作成
echo "📁 フォルダ構造を作成中..."

mkdir -p "$TEST_DIR"/{プロジェクトA,プロジェクトB,ドキュメント,作業中}
mkdir -p "$TEST_DIR/プロジェクトA"/{資料,コード,画像}
mkdir -p "$TEST_DIR/プロジェクトB"/{メモ,データ}
mkdir -p "$TEST_DIR/ドキュメント"/{2024,2025}
mkdir -p "$TEST_DIR/作業中"/{一時ファイル,バックアップ}

# サンプルファイルの作成
echo "📄 サンプルファイルを作成中..."

# ルートレベル
echo "# fließend テストフォルダ" > "$TEST_DIR/README.txt"
echo "このフォルダはfließendのテスト用です" >> "$TEST_DIR/README.txt"

# プロジェクトA
echo "# プロジェクトA 仕様書" > "$TEST_DIR/プロジェクトA/資料/仕様書.md"
echo "console.log('Hello, fließend!');" > "$TEST_DIR/プロジェクトA/コード/main.js"
echo "const app = require('./main');" > "$TEST_DIR/プロジェクトA/コード/index.js"
touch "$TEST_DIR/プロジェクトA/画像/screenshot.png"

# プロジェクトB
echo "- タスク1" > "$TEST_DIR/プロジェクトB/メモ/TODO.txt"
echo "- タスク2" >> "$TEST_DIR/プロジェクトB/メモ/TODO.txt"
echo "データファイル" > "$TEST_DIR/プロジェクトB/データ/data.csv"

# ドキュメント
echo "2024年の記録" > "$TEST_DIR/ドキュメント/2024/記録.txt"
echo "2025年の計画" > "$TEST_DIR/ドキュメント/2025/計画.txt"

# 作業中
echo "一時メモ" > "$TEST_DIR/作業中/一時ファイル/temp.txt"
echo "バックアップデータ" > "$TEST_DIR/作業中/バックアップ/backup.txt"

echo ""
echo "✅ テストフォルダの作成が完了しました！"
echo ""
echo "📍 作成場所: $TEST_DIR"
echo ""
echo "🚀 次のステップ:"
echo "   1. npm run dev でfließendを起動"
echo "   2. 「フォルダを開く」ボタンをクリック"
echo "   3. $TEST_DIR を選択"
echo "   4. Tab/Shift+Tab でフォルダ構造を編集してみましょう！"
echo ""
echo "📚 詳しい使い方は 使い方.md を参照してください"
echo ""

# 作成されたフォルダ構造を表示
if command -v tree &> /dev/null; then
  echo "📂 作成されたフォルダ構造:"
  tree -L 3 "$TEST_DIR"
else
  echo "📂 作成されたフォルダ構造:"
  find "$TEST_DIR" -type d | head -20
fi
