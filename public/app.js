// =================================================================
// 1. タグの重みづけ辞書（Vector Table）
// =================================================================
const TAG_WEIGHTS = {
  // タグ名: { nature:自然, child:子供, welfare:福祉, disaster:災害, community:街づくり }
  '子ども':         { nature: 0, child: 3, welfare: 1, disaster: 0, community: 1 },
  '学習支援':       { nature: 0, child: 3, welfare: 1, disaster: 0, community: 0 },
  '子ども食堂':     { nature: 0, child: 3, welfare: 2, disaster: 0, community: 2 },
  '居場所づくり':   { nature: 0, child: 1, welfare: 2, disaster: 0, community: 3 },
  '学校':           { nature: 0, child: 3, welfare: 0, disaster: 0, community: 1 },
  '掃除':           { nature: 2, child: 0, welfare: 0, disaster: 1, community: 2 },
  'クラフト':       { nature: 1, child: 2, welfare: 1, disaster: 0, community: 1 },
  '農園芸':         { nature: 3, child: 1, welfare: 1, disaster: 0, community: 1 },
  '放課後子供教室': { nature: 0, child: 3, welfare: 1, disaster: 0, community: 1 }
};

const DEFAULT_WEIGHT = { nature: 0, child: 0, welfare: 0, disaster: 0, community: 0 };

// 地域マッピング（ユーザー選択肢 ⇔ Notion地域タグの揺れ吸収）
const REGION_MAP = {
  osaka: ['大阪府', '高槻市', '茨木'],
  kyoto: ['京都府', '京都市'],
  any: [] // どこでもOK
};

// =================================================================
// 2. 質問設定（Q0に地域質問を追加）
// =================================================================
// 質問データ（Q1は地域選択、Q2〜Q6が5つのテーマ質問）
const questions = [
  // Q1: 地域選択（既存通り）
  {
    id: 'q_region',
    type: 'checkbox',
    text: 'Q1. 活動したい地域を選択してください（複数選択可）',
    options: [
      { label: '大阪エリア（茨木・高槻など）', value: 'osaka' },
      { label: '京都エリア（京都市など）', value: 'kyoto' },
      { label: 'どこでもOK / 指定なし', value: 'any' }
    ]
  },
  // Q2: 自然・環境
  {
    id: 'q_nature',
    type: 'radio',
    text: 'Q2. 自然との触れ合いや環境保全、農作業などの活動に興味はありますか？',
    attribute: 'nature',
    options: [
      { label: 'とても興味がある・やってみたい', value: 3 },
      { label: '機会があれば関わりたい', value: 1 },
      { label: 'あまりこだわりはない', value: 0 }
    ]
  },
  // Q3: 子ども・教育
  {
    id: 'q_child',
    type: 'radio',
    text: 'Q3. 子どもの成長支援や学習、子ども向けイベントに関わりたいですか？',
    attribute: 'child',
    options: [
      { label: 'ぜひ子どもに関わる活動がしたい', value: 3 },
      { label: '関われる機会があれば嬉しい', value: 1 },
      { label: 'あまりこだわりはない', value: 0 }
    ]
  },
  // Q4: 福祉・サポート
  {
    id: 'q_welfare',
    type: 'radio',
    text: 'Q4. 高齢者や障害のある方のサポート、福祉・共生社会に関心はありますか？',
    attribute: 'welfare',
    options: [
      { label: '福祉やサポート活動に興味がある', value: 3 },
      { label: '手助けできることがあればやりたい', value: 1 },
      { label: 'あまりこだわりはない', value: 0 }
    ]
  },
  // Q5: 防災・救護
  {
    id: 'q_disaster',
    type: 'radio',
    text: 'Q5. 防災啓発や地域の安全、災害対策などのボランティアに関心はありますか？',
    attribute: 'disaster',
    options: [
      { label: '防災・安全に関する活動をしたい', value: 3 },
      { label: '関心はある・学んでみたい', value: 1 },
      { label: 'あまりこだわりはない', value: 0 }
    ]
  },
  // Q6: まちづくり・地域活性
  {
    id: 'q_community',
    type: 'radio',
    text: 'Q6. 地域イベントの運営や居場所づくり、街の活性化に関わりたいですか？',
    attribute: 'community',
    options: [
      { label: '居場所づくりやイベントに関わりたい', value: 3 },
      { label: 'ゆるく地域とつながりたい', value: 1 },
      { label: 'あまりこだわりはない', value: 0 }
    ]
  }
];

// 状態管理
let currentQuestionIndex = 0;
let selectedRegions = []; // ★選択された地域キーの配列
let userPreferences = { child: 0, place: 0, support: 0, work: 0 };
let answerHistory = [];
let volunteerData = [];

// グローバル（window）に割り当てて HTML から呼び出せるように設定
window.handleAnswer = handleAnswer;
window.handleRegionAnswer = handleRegionAnswer;
window.goBack = goBack;
window.resetQuiz = resetQuiz;

// =================================================================
// 3. 初期化 & Expressサーバーからのデータ取得
// =================================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/api/volunteers');
    volunteerData = await response.json();
    showQuestion(currentQuestionIndex);
  } catch (error) {
    console.error('データ取得エラー:', error);
    document.getElementById('volunteer-list').innerHTML = 
      '<p class="loading" style="color: red;">データの読み込みに失敗しました。</p>';
  }
});

// =================================================================
// 4. 質問画面の描画
// =================================================================
function showQuestion(index) {
  const q = questions[index];
  const container = document.getElementById('volunteer-list');

  let optionsHtml = '';

  if (q.type === 'checkbox') {
    // 地域選択（チェックボックス）の描画
    optionsHtml = `
      <form id="region-form" style="display: flex; flex-direction: column; gap: 12px; text-align: left; max-width: 320px; margin: 0 auto;">
        ${q.options.map(opt => {
          const isChecked = selectedRegions.includes(opt.value) ? 'checked' : '';
          return `
            <label style="font-size: 1.05rem; cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 6px 0;">
              <input type="checkbox" name="region" value="${opt.value}" ${isChecked} style="transform: scale(1.3);">
              ${opt.label}
            </label>
          `;
        }).join('')}
        <button type="button" onclick="handleRegionAnswer()" class="quiz-option-btn" style="margin-top: 15px; background: #007bff; color: white;">
          次へ進む ➔
        </button>
      </form>
    `;
  } else {
    // 既存の単一選択ボタンの描画
    optionsHtml = q.options.map(opt => `
      <button class="quiz-option-btn" onclick="handleAnswer('${q.attribute}', ${opt.value})">
        ${opt.label}
      </button>
    `).join('');
  }

  // 1問目以外のときだけ「戻る」ボタンを表示
  const backButtonHtml = index > 0 ? `
    <button class="back-btn" onclick="goBack()" style="margin-top: 15px; background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
      ← 前の質問に戻る
    </button>
  ` : '';

  container.innerHTML = `
    <div class="quiz-card">
      <p class="quiz-step">第 ${index + 1} 問 / 全 ${questions.length} 問</p>
      <h2 class="quiz-title">${q.text}</h2>
      <div class="quiz-options">
        ${optionsHtml}
      </div>
      ${backButtonHtml}
    </div>
  `;
}

// =================================================================
// 5. 回答処理
// =================================================================

// 【地域回答時の処理】
function handleRegionAnswer() {
  const checkboxes = document.querySelectorAll('input[name="region"]:checked');
  const values = Array.from(checkboxes).map(cb => cb.value);

  if (values.length === 0) {
    alert('少なくとも1つの地域を選択してください。');
    return;
  }

  // 履歴保存＆状態更新
  answerHistory.push({
    type: 'region',
    previousValue: [...selectedRegions]
  });
  selectedRegions = values;

  currentQuestionIndex++;
  showQuestion(currentQuestionIndex);
}

// 【属性スコア回答時の処理】
function handleAnswer(attribute, value) {
  answerHistory.push({
    type: 'attribute',
    attribute: attribute,
    previousValue: userPreferences[attribute]
  });

  userPreferences[attribute] = value;
  currentQuestionIndex++;

  if (currentQuestionIndex < questions.length) {
    showQuestion(currentQuestionIndex);
  } else {
    showResults();
  }
}

// 【一つ前の問題に戻る処理】
function goBack() {
  if (currentQuestionIndex <= 0) return;

  const lastAnswer = answerHistory.pop();

  if (lastAnswer) {
    if (lastAnswer.type === 'region') {
      selectedRegions = lastAnswer.previousValue;
    } else if (lastAnswer.type === 'attribute') {
      userPreferences[lastAnswer.attribute] = lastAnswer.previousValue;
    }
  }

  currentQuestionIndex--;
  showQuestion(currentQuestionIndex);
}

// =================================================================
// 6. 重みづけマッチング計算 & 結果描画（地域絞り込み適用）
// =================================================================
// =================================================================
// 6. 重みづけマッチング計算 & 結果描画（平均スコア方式 適用版）
// =================================================================
function showResults() {
  const container = document.getElementById('volunteer-list');

  // 1. 地域による事前フィルタリング
  const regionFilteredVolunteers = volunteerData.filter(item => {
    if (selectedRegions.includes('any')) return true;

    const allowedTags = selectedRegions.flatMap(regKey => REGION_MAP[regKey] || []);
    const itemRegions = Array.isArray(item.region) ? item.region : [item.region];
    
    return itemRegions.some(r => allowedTags.includes(r));
  });

  // 2. 絞り込まれたボランティアに対して「平均相性スコア」を計算
  const scoredVolunteers = regionFilteredVolunteers.map(item => {
    let totalScore = 0;
    
    // 各タグごとのスコアを合計
    item.tags.forEach(tagName => {
      const weights = TAG_WEIGHTS[tagName] || DEFAULT_WEIGHT;
      for (const attr in userPreferences) {
        totalScore += (weights[attr] || 0) * (userPreferences[attr] || 0);
      }
    });

    // ★ 改善ポイント: タグ数で割って平均スコアを出す（0割防止のため最小値を1に）
    const tagCount = item.tags.length > 0 ? item.tags.length : 1;
    
    // 小数第1位までに丸める（例: 2.333... -> 2.3）
    const averageScore = Math.round((totalScore / tagCount) * 10) / 10;

    return {
      ...item,
      matchScore: averageScore
    };
  })
  // スコアが 0 より大きいものだけを残す
  .filter(item => item.matchScore > 0)
  // 平均スコアが高い順（降順）にソート
  .sort((a, b) => b.matchScore - a.matchScore);

  // 該当なしの場合
  if (scoredVolunteers.length === 0) {
    container.innerHTML = `
      <div class="result-header">
        <h2>🔍 診断完了</h2>
        <p>選択された地域・条件に合致するボランティアが見つかりませんでした。</p>
        <button onclick="resetQuiz()" class="retry-btn">もう一度診断する</button>
      </div>
    `;
    return;
  }

  // 結果カードの生成
  const cardsHtml = scoredVolunteers.map(item => {
    const tagsHtml = item.tags.map(tag => `<span class="tag"># ${tag}</span>`).join('');
    const regionDisplay = Array.isArray(item.region) ? item.region.join(', ') : (item.region || '未設定');

    return `
      <div class="card">
        <div>
          <span class="match-badge">相性度: ${item.matchScore}</span>
          <h2 class="card-title">${item.title}</h2>
          <p class="card-org">🏢 ${item.organization}</p>
          <p class="card-region" style="font-size: 0.9rem; color: #555; margin: 4px 0;">📍 地域: ${regionDisplay}</p>
          <div class="tag-container">${tagsHtml}</div>
        </div>
        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="card-link">Notionで詳細を見る</a>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="result-header">
      <h2>あなたにおすすめのボランティア</h2>
      <p>分析の結果から,相性の良い順に表示しています</p>
      <button onclick="resetQuiz()" class="retry-btn">もう一度診断する</button>
    </div>
    <div class="card-grid">
      ${cardsHtml}
    </div>
  `;
}

// =================================================================
// 7. 診断のリセット処理
// =================================================================
function resetQuiz() {
  currentQuestionIndex = 0;
  selectedRegions = [];
  userPreferences = { child: 0, place: 0, support: 0, work: 0 };
  answerHistory = [];
  
  showQuestion(currentQuestionIndex);
}