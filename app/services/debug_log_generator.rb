class DebugLogGenerator
  MODEL = "claude-sonnet-4-6"

  def initialize(input)
    @input  = input
    @client = Anthropic::Client.new(access_token: ENV["ANTHROPIC_API_KEY"])
  end

  def stream(&block)
    @client.messages(parameters: {
      model:      MODEL,
      max_tokens: 1536,
      stream: proc { |chunk, _raw|
        next unless chunk.dig("type") == "content_block_delta"
        text = chunk.dig("delta", "text")
        block.call(text) if text
      },
      messages: [{ role: "user", content: prompt }]
    })
  end

  private

  def prompt
    <<~PROMPT
      あなたはAI診断エンジン「DebugMe」です。
      ユーザーの悩みを分析し、以下のJSON形式のみで応答してください。
      JSONのみを出力し、マークダウンコードブロック（```）や説明文は一切含めないでください。

      {
        "summary": {
          "severity": 0〜100の整数（悩みの深刻度）,
          "self_esteem": 0〜100の整数（自己肯定感の低さ・高いほど問題あり）,
          "action": 0〜100の整数（行動不足度・高いほど行動できていない）,
          "communication": 0〜100の整数（コミュニケーション課題度）,
          "logic": 0〜100の整数（感情的思考度・高いほど感情的）
        },
        "caused_by": "根本原因を英語のコード風で一行（例: Self::Confidence < Minimum）",
        "hint": "最初の一歩を日本語で一文（例: まずは自分を大切にすることから始めましょう）",
        "error_log": "プログラムのエラーログ風のテキスト（改行を含む、ユーモラスに）",
        "suggested_fix": ["短いアドバイス1", "短いアドバイス2", "短いアドバイス3"]
      }

      error_logの形式（以下の形式を厳守）：
      [ERROR] エラークラス名::サブクラス名 (英語のプログラムエラー名風)
      日本語で一言の説明

        at Life.expectation_vs_reality (life.rb:42)
        at Self.confidence_check (mind.rb:行番号)

      再試行回数    : 数字
      最終通信      : 〇〇前
      エラーレベル  : 🔴 FATAL（または 🟠 ERROR または 🟡 WARN）

      ルール：
      - stack traceの「at ...」行は最大2行まで（多すぎると読みにくい）
      - error_logはユーモアたっぷりに、でも共感的に
      - suggested_fixは【重要】各10〜15文字以内の超短い日本語で。例：「まず5分だけ動く」「誰かに話す」「1つだけ応募する」
      - JSONのみ出力（前後に文字を入れない）

      ユーザーの悩み：#{@input}
    PROMPT
  end
end
