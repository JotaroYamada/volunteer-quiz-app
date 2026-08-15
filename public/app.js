// =================================================================
// 1. タグの重みづけ辞書（Vector Table）
// 4次元: child(子ども/教育), place(居場所/交流), support(学び/成長), work(体験/作業)
// ※ メンバーとの議論で数値や項目を調整・追加できます
// =================================================================
const TAG_WEIGHTS = {
  '放課後子供教室': { child: 3, place: 2, support: 2, work: 1 },
  '子ども':         { child: 3, place: 1, support: 1, work: 0 },
  '学校':           { child: 3, place: 1, support: 2, work: 0 },
  '子ども食堂':     { child: 3, place: 3, support: 1, work: 1 },
  '掃除':           { child: 0, place: 1, support: 0, work: 3 },
  '居場所づくり':   { child: 2, place: 3, support: 1, work: 1 },
  '学習支援':       { child: 3, place: 2, support: 3, work: 0 },
  'クラフト':       { child: 1, place: 1, support: 0, work: 3 },
  '農園芸':         { child: 1, place: 1, support: 0, work: 3 }
};

const DEFAULT_WEIGHT = { child: 0, place: 0, support: 0, work: 0 };

// =================================================================
// 2. 質問設定（ユーザーの希望ベクトルを作るための質問）
// =================================================================
const questions = [
  {
    id: 'q_child',
    text: 'Q1. 子どもや学生に関わる活動にどのくらい興味がありますか？',
    attribute: 'child',
    options: [
      { label: '🔥 とても関わりたい', value: 3 },
      { label: '😊 機会があれば関わりたい', value: 2 },
      { label: 'どちらでもいい / あまりこだわらない', value: 0 }
    ]
  },
  {
    id: 'q_place',
    text: 'Q2. 居場所づくりや、地域の人との交流空間を作ることに関心はありますか？',
    attribute: 'place',
    options: [
      { label: '🏠 居場所づくり・空間作りに興味がある', value: 3 },
      { label: '🤝 ゆるやかな交流があればOK', value: 2 },
      { label: 'あまりこだわらない', value: 0 }
    ]
  },
  {
    id: 'q_support',
    text: 'Q3. 誰かに勉強や知識を教えたり、成長をサポートする活動はどうですか？',
    attribute: 'support',
    options: [
      { label: '📚 勉強を教えたりサポートしたい', value: 3 },
      { label: 'サポート役に興味はある', value: 2 },
      { label: 'あまりこだわらない', value: 0 }
    ]
  },
  {
    id: 'q_work',
    text: 'Q4. 作成作業や農作業、体を動かすような体験型活動に興味はありますか？',
    attribute: 'work',
    options: [
      { label: '🎨 手作業や農作業などをやってみたい', value: 3 },
      { label: '体を動かす程度ならOK', value: 2 },
      { label: 'あまりこだわらない', value: 0 }
    ]
  }
];

// 状態管理
let currentQuestionIndex = 0;
let userPreferences = { child: 0, place: 0, support: 0, work: 0 };
let volunteerData = [];

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

  const optionsHtml = q.options.map(opt => `
    <button class="quiz-option-btn" onclick="handleAnswer('${q.attribute}', ${opt.value})">
      ${opt.label}
    </button>
  `).join('');

  container.innerHTML = `
    <div class="quiz-card">
      <p class="quiz-step">第 ${index + 1} 問 / 全 ${questions.length} 問</p>
      <h2 class="quiz-title">${q.text}</h2>
      <div class="quiz-options">
        ${optionsHtml}
      </div>
    </div>
  `;
}

// =================================================================
// 5. 回答処理 & 次の質問へ
// =================================================================
function handleAnswer(attribute, value) {
  // ユーザーの回答を希望ベクトルに保存
  userPreferences[attribute] = value;
  currentQuestionIndex++;

  if (currentQuestionIndex < questions.length) {
    showQuestion(currentQuestionIndex);
  } else {
    showResults();
  }
}

// =================================================================
// 6. 重みづけマッチング計算 & 結果描画
// =================================================================
function showResults() {
  const container = document.getElementById('volunteer-list');

  // 各ボランティアのスコアを計算
  const scoredVolunteers = volunteerData.map(item => {
    let score = 0;
    item.tags.forEach(tagName => {
      const weights = TAG_WEIGHTS[tagName] || DEFAULT_WEIGHT;
      for (const attr in userPreferences) {
        score += (weights[attr] || 0) * (userPreferences[attr] || 0);
      }
    });

    return {
      ...item,
      matchScore: score
    };
  })
  .filter(item => item.matchScore > 0)
  .sort((a, b) => b.matchScore - a.matchScore);

  // 該当なしの場合
  if (scoredVolunteers.length === 0) {
    container.innerHTML = `
      <div class="result-header">
        <h2>🔍 診断完了</h2>
        <p>回答に合致するボランティアが見つかりませんでした。</p>
        <button onclick="resetQuiz()" class="retry-btn">🔄 もう一度診断する</button>
      </div>
    `;
    return;
  }

  // 結果がある場合（★ヘッダーに「もう一度診断する」ボタンを追加）
  const cardsHtml = scoredVolunteers.map(item => {
    const tagsHtml = item.tags.map(tag => `<span class="tag"># ${tag}</span>`).join('');
    return `
      <div class="card">
        <div>
          <span class="match-badge">相性スコア: ${item.matchScore} pt</span>
          <h2 class="card-title">${item.title}</h2>
          <p class="card-org">🏢 ${item.organization}</p>
          <div class="tag-container">${tagsHtml}</div>
        </div>
        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="card-link">Notionで詳細を見る</a>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="result-header">
      <h2>🎉 あなたにおすすめのボランティア</h2>
      <p>相性スコアが高い順に表示しています</p>
      <button onclick="resetQuiz()" class="retry-btn">🔄 もう一度診断する</button>
    </div>
    <div class="card-grid">
      ${cardsHtml}
    </div>
  `;
}

// =================================================================
// 7. 診断のリセット処理（★新規追加）
// =================================================================
function resetQuiz() {
  // 状態を完全に初期化
  currentQuestionIndex = 0;
  userPreferences = { child: 0, place: 0, support: 0, work: 0 };
  
  // 最初の質問を表示
  showQuestion(currentQuestionIndex);
}