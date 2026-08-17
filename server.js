import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Client } from '@notionhq/client';

const app = express();

// ミドルウェアの設定（app.listen の前に記述）
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // 静的ファイル（index.htmlやapp.jsなど）の提供

// Notionクライアントの初期化
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// APIエンドポイント: /api/volunteers
app.get('/api/volunteers', async (req, res) => {
  try {
    // 1. Notion API からデータ取得
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID
    });

    // 2. データの整形
    const volunteers = response.results
      .filter(page => page.properties['件名']?.title?.length > 0)
      .map(page => {
        const props = page.properties;

        // ★追加: 「地域」列のパース処理（マルチセレクト / セレクトの両対応）
        let regionData = [];
        const regionProp = props['地域'];

        if (regionProp) {
          if (regionProp.type === 'multi_select' && regionProp.multi_select) {
            regionData = regionProp.multi_select.map(item => item.name);
          } else if (regionProp.type === 'select' && regionProp.select) {
            regionData = [regionProp.select.name];
          }
        }

        return {
          id: page.id,
          title: props['件名']?.title[0]?.plain_text || 'タイトルなし',
          tags: props['タグ']?.multi_select?.map(tag => tag.name) || [],
          organization: props['団体名']?.rich_text[0]?.plain_text || '未設定',
          region: regionData, // ★追加: 整形済み地域データをレスポンスに挿入
          url: page.url
        };
      });

    // 3. 整形済みデータをJSON形式でブラウザに返却
    res.json(volunteers);

  } catch (error) {
    console.error('サーバーエラー:', error);
    res.status(500).json({ error: 'データの取得に失敗しました。' });
  }
});

// サーバー起動処理は一番最後に記述
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});