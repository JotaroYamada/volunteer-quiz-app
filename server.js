import express from 'express';
import cors from 'cors';
import { Client } from '@notionhq/client';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// CORSを許可（ブラウザからのアクセスを受け入れ）
app.use(cors());

// Notionクライアントの初期化（APIキーは.envから安全に取得）
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// APIエンドポイント: /api/volunteers
app.get('/api/volunteers', async (req, res) => {
  try {
    // 1. Notion API からデータ取得
    const response = await notion.dataSources.query({
      data_source_id: process.env.NOTION_DATABASE_ID,
      page_size: 100,
    });

    // 2. データの整形（これまで作ってきたロジック）
    const volunteers = response.results
      .filter(page => page.properties['件名']?.title?.length > 0)
      .map(page => {
        const props = page.properties;
        return {
          id: page.id,
          title: props['件名']?.title[0]?.plain_text || 'タイトルなし',
          tags: props['タグ']?.multi_select?.map(tag => tag.name) || [],
          organization: props['団体名']?.rich_text[0]?.plain_text || '未設定',
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

// 静的ファイル（index.htmlやapp.jsなど）をpublicフォルダから提供する場合の設定
app.use(express.static('public'));