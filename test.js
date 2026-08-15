import { Client } from '@notionhq/client';
import 'dotenv/config';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function getFormattedVolunteers() {
  try {
    // 1. Notionから生のデータを取得
    const response = await notion.dataSources.query({
      data_source_id: process.env.NOTION_DATABASE_ID,
      page_size: 100,
    });

    // 2. 理想的なデータ構造へ変換（整形）
    const volunteers = response.results
      // 件名（タイトル）が存在するページだけに対象を絞る（空ページを除外）
      .filter(page => page.properties['件名']?.title?.length > 0)
      .map(page => {
        const props = page.properties;

        return {
          id: page.id,
          // タイトルを直接取得
          title: props['件名']?.title[0]?.plain_text || 'タイトルなし',
          // タグの配列を作成（例: ["子ども", "学習支援"]）
          tags: props['タグ']?.multi_select?.map(tag => tag.name) || [],
          // 団体名（未入力の場合は'未設定'）
          organization: props['団体名']?.rich_text[0]?.plain_text || '未設定',
          // Notionの直接リンク
          url: page.url
        };
      });
    // 2. 「子ども」タグが含まれるボランティアだけに絞り込む
    const searchKeywords = ['子ども', 'こども', '子供'];

    const filteredVolunteers = volunteers.filter(item => {
      return item.tags.some(tag => searchKeywords.includes(tag));
    });

    // 3. 整形後のシンプルなデータを表示
    console.log('🎉 整形完了！扱いやすくなったデータ一覧:\n');
    console.log(filteredVolunteers);

  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
  }
}

getFormattedVolunteers();