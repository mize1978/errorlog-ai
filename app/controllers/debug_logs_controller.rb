class DebugLogsController < ApplicationController
  include ActionController::Live

  DAILY_QUOTES = [
    "バグは悪くない。バグってるのは自分じゃなくて、環境だ。",
    "Small fixes. Better days.",
    "エラーは、次の一歩のログ。",
    "人生はデバッグの繰り返し。",
    "コードも心も、リファクタリングで輝く。",
    "404: 完璧な人間は見つかりません。",
    "エラーは成長への招待状。",
  ].freeze

  DEBUG_HINTS = [
    "エラーは\n原因が見つかった瞬間から\n修正が始まる。",
    "悩みも、デバッグすれば\n小さな問題に分解できる。",
    "完璧なコードはない。\n完璧に向かうプロセスがある。",
    "問題を言語化できれば、\n半分は解決している。",
    "一度に一つのバグを直す。\n焦るな。",
    "ログを書くことは、\n自分の思考を整理すること。",
    "エラーを隠すな。\nまずログに残せ。",
  ].freeze

  def new
    @debug_log = DebugLog.new
    @popular   = DebugLog.where.not(output: nil).order(view_count: :desc).limit(5)
    @hint      = DEBUG_HINTS[Date.today.yday % DEBUG_HINTS.size]
    @quote     = DAILY_QUOTES[Date.today.yday % DAILY_QUOTES.size]
  end

  def create
    @debug_log = DebugLog.new(
      input:      debug_log_params[:input],
      ip_hash:    Digest::SHA256.hexdigest(request.remote_ip),
      view_count: 0
    )

    if @debug_log.save
      redirect_to @debug_log
    else
      render :new, status: :unprocessable_entity
    end
  end

  def show
    @debug_log = DebugLog.find(params[:id])
    @debug_log.increment!(:view_count)
    @quote = DAILY_QUOTES[Date.today.yday % DAILY_QUOTES.size]
  end

  def stream
    @debug_log = DebugLog.find(params[:id])

    response.headers["Content-Type"]      = "text/event-stream"
    response.headers["Cache-Control"]     = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"
    response.headers["Connection"]        = "keep-alive"

    sse = ActionController::Live::SSE.new(response.stream, retry: 300)

    begin
      generator  = DebugLogGenerator.new(@debug_log.input)
      raw_json   = ""

      generator.stream do |chunk|
        raw_json += chunk
        sse.write({ type: "chunk" }.to_json)
      end

      cleaned = raw_json.strip.gsub(/\A```(?:json)?\n?/, "").gsub(/\n?```\z/, "")
      data    = JSON.parse(cleaned)

      @debug_log.update!(output: data["error_log"])

      log_time = @debug_log.created_at.strftime("%Y-%m-%d %H:%M:%S")
      log_id   = "DM-#{@debug_log.created_at.to_i}-#{SecureRandom.hex(3).upcase}"

      sse.write(
        {
          type:          "complete",
          summary:       data["summary"],
          caused_by:     data["caused_by"],
          hint:          data["hint"],
          log_time:      log_time,
          log_id:        log_id,
          error_log:     data["error_log"],
          suggested_fix: data["suggested_fix"]
        }.to_json,
        event: "complete"
      )
    rescue JSON::ParserError => e
      @debug_log.update!(output: raw_json)
      sse.write(
        {
          type:          "complete",
          summary:       { severity: 50, self_esteem: 50, action: 50, communication: 50, logic: 50 },
          error_log:     raw_json,
          suggested_fix: ["もう一度試してみてください", "深呼吸して", "大丈夫！"]
        }.to_json,
        event: "complete"
      )
    rescue => e
      sse.write({ type: "error", message: e.message }.to_json, event: "error")
    ensure
      sse.close
    end
  end

  def ranking
    @logs = DebugLog.where.not(output: nil)
                    .order(view_count: :desc)
                    .limit(20)
  end

  private

  # Strong Parameters: 許可した属性のみを受け取る（Mass Assignment 対策）
  def debug_log_params
    params.require(:debug_log).permit(:input)
  end
end
