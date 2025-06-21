はじめに
このドキュメントは、Riot Games APIの各エンドポイントを、開発者がアプリケーション（例：OP.GGのような戦績サイト）を効率的に構築できるよう、機能カテゴリごとに再編したものです。各APIについて、リクエストに必要なパラメータとレスポンスのデータ構造（DTO）を明確に記述しています。
基本的な考え方:
機能ベースのグルーピング: 関連性の高いAPIを「アカウント」「サマナー情報」「リーグ/ランク」「試合情報」などのサービス単位でまとめ、目的から必要なAPIを見つけやすくしています。
情報の集約: 各エンドポイントに必要な情報（HTTPメソッド、URL、パラメータ、レスポンス、リージョン）を1箇所に集約し、一貫したフォーマットで記述しています。
DTOの明確化: レスポンスとして返されるデータオブジェクト（DTO）の構造を、ネストされたオブジェクトも含めて分かりやすくテーブル形式で示しています。
目次
Account API (v1) - ユーザーアカウント情報
Summoner API (v4) - LoL/TFT サマナー情報
League API (v4) - LoL ランク/リーグ情報
Match API (v5) - LoL 試合情報
Spectator API (v5) - LoL 観戦情報
Champion Mastery API (v4) - LoL チャンピオンマスタリー
Champion API (v3) - LoL チャンピオン情報
TFT League API (v1) - TFT ランク/リーグ情報
TFT Match API (v1) - TFT 試合情報
Valorant Content API (v1) - VALORANT ゲームコンテンツ
Valorant Match API (v1) - VALORANT 試合情報
Valorant Ranked API (v1) - VALORANT ランク情報
共通API (Clash, Challenges, Status, etc.)
<a name="account-api"></a>
1. Account API (v1)
ユーザーのRiotアカウント情報を扱うAPIです。PUUIDとRiot ID（ゲーム名 + タグライン）の相互変換の基点となります。
1.1. Riot IDによるアカウント情報取得
説明: Riot ID（ゲーム名とタグライン）を使用してアカウント情報を取得します。
リージョン: AMERICAS, ASIA, EUROPE
HTTP Request: GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}
Path Parameters
| Name | Data Type | Description |
| :--- | :--- | :--- |
| gameName| string | 検索対象のプレイヤーのゲーム名。 |
| tagLine | string | 検索対象のプレイヤーのタグライン。 |
Response (Success): AccountDto
| Name | Data Type | Description |
| :--- | :--- | :--- |
| puuid | string | 暗号化されたPUUID（78文字）。 |
| gameName | string | アカウントのゲーム名。存在しない場合は省略されます。 |
| tagLine | string | アカウントのタグライン。存在しない場合は省略されます。 |
1.2. PUUIDによるアカウント情報取得
説明: PUUIDを使用してアカウント情報を取得します。
リージョン: AMERICAS, ASIA, EUROPE
HTTP Request: GET /riot/account/v1/accounts/by-puuid/{puuid}
Path Parameters
| Name | Data Type | Description |
| :--- | :--- | :--- |
| puuid| string | 検索対象のプレイヤーのPUUID。 |
Response (Success): AccountDto (上記1.1と同様)
<a name="summoner-api"></a>
2. Summoner API (v4)
League of LegendsおよびTFTのサマナー（プレイヤー）固有の情報を取得します。
2.1. PUUIDによるサマナー情報取得
説明: PUUIDを使用してサマナー情報を取得します。
リージョン: BR1, EUN1, EUW1, JP1, KR, LA1, LA2, NA1, OC1, TR1, RU
HTTP Request: GET /lol/summoner/v4/summoners/by-puuid/{encryptedPUUID}
Path Parameters
| Name | Data Type | Description |
| :--- | :--- | :--- |
| encryptedPUUID | string | プレイヤーの暗号化されたPUUID。 |
Response (Success): SummonerDTO
| Name | Data Type | Description |
| :--- | :--- | :--- |
| id | string | 暗号化されたサマナーID。 |
| accountId | string | 暗号化されたアカウントID。 |
| puuid | string | 暗号化されたPUUID。 |
| profileIconId | int | 使用中のサモナーアイコンのID。 |
| revisionDate | long | サマナー情報が最後に更新された日時（エポックミリ秒）。 |
| summonerLevel | long | サマナーレベル。 |
(注: by-account/{encryptedAccountId} や by-summoner/{encryptedSummonerId} など、他のIDでも同様の情報を取得可能です)
<a name="league-api"></a>
3. League API (v4)
League of Legendsのランクやリーグに関する情報を取得します。
3.1. PUUIDによるリーグ情報取得
説明: 指定したPUUIDのプレイヤーが所属する全てのキューのリーグ情報を取得します。
リージョン: 各ゲームサーバーリージョン
HTTP Request: GET /lol/league/v4/entries/by-puuid/{encryptedPUUID}
Path Parameters
| Name | Data Type | Description |
| :--- | :--- | :--- |
| encryptedPUUID | string | プレイヤーの暗号化されたPUUID。 |
Response (Success): Set<LeagueEntryDTO>
LeagueEntryDTO
| Name | Data Type | Description |
| :--- | :--- | :--- |
| leagueId| string | リーグのUUID。 |
| summonerId| string | プレイヤーの暗号化されたサマナーID。 |
| puuid | string | プレイヤーの暗号化されたPUUID。 |
| queueType | string | キューの種類（例: RANKED_SOLO_5x5）。 |
| tier | string | ティア（例: GOLD, DIAMOND）。 |
| rank | string | ティア内の階級（例: I, II）。 |
| leaguePoints| int | リーグポイント。 |
| wins | int | 勝利数。 |
| losses | int | 敗北数。 |
| veteran | boolean | ベテランプレイヤーか。 |
| inactive | boolean | 非アクティブ状態か。 |
| freshBlood| boolean | 新規参入プレイヤーか。 |
| hotStreak | boolean | 連勝中か。 |
| miniSeries| MiniSeriesDTO| 昇格戦の情報。 |
MiniSeriesDTO
| Name | Data Type | Description |
| :--- | :--- | :--- |
| losses | int | 昇格戦での敗北数。 |
| progress | string | 昇格戦の進捗（W=勝利, L=敗北, N=未実施）。 |
| target | int | 勝利目標数。 |
| wins | int | 昇格戦での勝利数。 |
3.2. 特定ティアのリーグ情報取得
説明: 指定したキュー、ティア、ディビジョンのリーグに所属するプレイヤー一覧を取得します。
リージョン: 各ゲームサーバーリージョン
HTTP Request: GET /lol/league/v4/entries/{queue}/{tier}/{division}
Path/Query Parameters
| Name | Type | Data Type | Description |
| :--- | :--- | :--- | :--- |
| queue | Path | string | キューの種類（例: RANKED_SOLO_5x5）。 |
| tier | Path | string | ティア（例: GOLD）。 |
| division| Path | string | 階級（例: I）。 |
| page | Query | int | 取得するページ番号（デフォルト: 1）。 |
Response (Success): Set<LeagueEntryDTO> (上記3.1と同様)
<a name="match-api"></a>
4. Match API (v5)
League of Legendsの試合履歴や詳細情報を取得します。
4.1. PUUIDによる試合IDリスト取得
説明: PUUIDを元に、プレイヤーの試合IDのリストを取得します。
リージョン: AMERICAS, ASIA, EUROPE, ESPORTS
HTTP Request: GET /lol/match/v5/matches/by-puuid/{puuid}/ids
Path/Query Parameters
| Name | Type | Data Type | Description |
| :--- | :--- | :--- | :--- |
| puuid | Path | string | プレイヤーのPUUID。 |
| startTime| Query | long | 検索開始時間（Unixタイムスタンプ秒）。 |
| endTime | Query | long | 検索終了時間（Unixタイムスタンプ秒）。 |
| queue | Query | int | キューIDによるフィルタ。 |
| type | Query | string | 試合タイプによるフィルタ (ranked, normal, tourney, tutorial)。 |
| start | Query | int | 開始インデックス（デフォルト: 0）。 |
| count | Query | int | 取得数（デフォルト: 20, 最大: 100）。 |
Response (Success): List<string>
試合IDの文字列のリストが返されます。例: ["JP1_123456789", "JP1_987654321", ...]
4.2. 試合IDによる試合詳細情報取得
説明: 試合IDを元に、その試合の詳細データを取得します。
リージョン: AMERICAS, ASIA, EUROPE, ESPORTS
HTTP Request: GET /lol/match/v5/matches/{matchId}
Path Parameters
| Name | Data Type | Description |
| :--- | :--- | :--- |
| matchId | string | 試合ID。 |
Response (Success): MatchDto
このDTOは非常に多くの情報を含みます。主要なものを以下に示します。
MatchDto
| Name | Data Type | Description |
| :--- | :--- | :--- |
| metadata | MetadataDto | 試合のメタデータ。 |
| info | InfoDto | 試合のコア情報。 |
MetadataDto
| Name | Data Type | Description |
| :--- | :--- | :--- |
| dataVersion| string | データバージョン。 |
| matchId | string | 試合ID。 |
| participants| List<string> | 参加者のPUUIDリスト。 |
InfoDto
| Name | Data Type | Description |
| :--- | :--- | :--- |
| gameCreation | long | 試合作成時刻。 |
| gameDuration | long | 試合時間。 |
| gameEndTimestamp| long | 試合終了時刻。 |
| gameMode | string | ゲームモード。 |
| queueId | int | キューID。 |
| participants | List<ParticipantDto> | 各参加者の詳細データリスト。 |
| teams | List<TeamDto>| 各チームの情報（BANなど）。 |
ParticipantDto (主要項目)
| Name | Data Type | Description |
| :--- | :--- | :--- |
| puuid | string | プレイヤーのPUUID。 |
| summonerName | string | サモナー名。 |
| championName | string | 使用チャンピオン名。 |
| kills | int | キル数。 |
| deaths | int | デス数。 |
| assists | int | アシスト数。 |
| totalDamageDealtToChampions | int | チャンピオンへの合計ダメージ。 |
| goldEarned | int | 獲得ゴールド。 |
| item0...item6 | int | アイテムID。 |
| win | boolean | 勝利したか。 |
| perks | PerksDto| 使用したルーンの情報。 |
4.3. 試合IDによる試合タイムライン取得
説明: 試合IDを元に、試合のタイムラインデータ（イベント、フレームごとの状態）を取得します。
リージョン: AMERICAS, ASIA, EUROPE, ESPORTS
HTTP Request: GET /lol/match/v5/matches/{matchId}/timeline
Response (Success): TimelineDto
試合中のイベント（キル、オブジェクト破壊など）や、各プレイヤーの1分ごとの状態（ゴールド、経験値、位置など）が含まれます。非常に詳細なデータです。
(このドキュメントは、提供されたAPI情報の一部を開発者向けに再構成したものです。TFT, Valorant, Clashなど他のAPIも同様の形式で整理・追加することが可能です。)