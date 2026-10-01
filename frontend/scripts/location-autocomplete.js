/**
 * location-autocomplete.js
 * 都道府県・市区町村の入力補助コンポーネント
 *
 * 使い方:
 *   initLocationAutocomplete('inputId');
 *   // id="inputId" の <input> を都道府県＋市区町村の2段フィールドに置き換える。
 *   // 元のinputはhidden化され、"都道府県 市区町村" の値が自動セットされる。
 */

const LOC_PREFS = [
  { name:'北海道', yomi:'ほっかいどう' },
  { name:'青森県', yomi:'あおもりけん' },
  { name:'岩手県', yomi:'いわてけん' },
  { name:'宮城県', yomi:'みやぎけん' },
  { name:'秋田県', yomi:'あきたけん' },
  { name:'山形県', yomi:'やまがたけん' },
  { name:'福島県', yomi:'ふくしまけん' },
  { name:'茨城県', yomi:'いばらきけん' },
  { name:'栃木県', yomi:'とちぎけん' },
  { name:'群馬県', yomi:'ぐんまけん' },
  { name:'埼玉県', yomi:'さいたまけん' },
  { name:'千葉県', yomi:'ちばけん' },
  { name:'東京都', yomi:'とうきょうと' },
  { name:'神奈川県', yomi:'かながわけん' },
  { name:'新潟県', yomi:'にいがたけん' },
  { name:'富山県', yomi:'とやまけん' },
  { name:'石川県', yomi:'いしかわけん' },
  { name:'福井県', yomi:'ふくいけん' },
  { name:'山梨県', yomi:'やまなしけん' },
  { name:'長野県', yomi:'ながのけん' },
  { name:'岐阜県', yomi:'ぎふけん' },
  { name:'静岡県', yomi:'しずおかけん' },
  { name:'愛知県', yomi:'あいちけん' },
  { name:'三重県', yomi:'みえけん' },
  { name:'滋賀県', yomi:'しがけん' },
  { name:'京都府', yomi:'きょうとふ' },
  { name:'大阪府', yomi:'おおさかふ' },
  { name:'兵庫県', yomi:'ひょうごけん' },
  { name:'奈良県', yomi:'ならけん' },
  { name:'和歌山県', yomi:'わかやまけん' },
  { name:'鳥取県', yomi:'とっとりけん' },
  { name:'島根県', yomi:'しまねけん' },
  { name:'岡山県', yomi:'おかやまけん' },
  { name:'広島県', yomi:'ひろしまけん' },
  { name:'山口県', yomi:'やまぐちけん' },
  { name:'徳島県', yomi:'とくしまけん' },
  { name:'香川県', yomi:'かがわけん' },
  { name:'愛媛県', yomi:'えひめけん' },
  { name:'高知県', yomi:'こうちけん' },
  { name:'福岡県', yomi:'ふくおかけん' },
  { name:'佐賀県', yomi:'さがけん' },
  { name:'長崎県', yomi:'ながさきけん' },
  { name:'熊本県', yomi:'くまもとけん' },
  { name:'大分県', yomi:'おおいたけん' },
  { name:'宮崎県', yomi:'みやざきけん' },
  { name:'鹿児島県', yomi:'かごしまけん' },
  { name:'沖縄県', yomi:'おきなわけん' },
];

const LOC_CITIES = {
  '北海道': [
    {name:'札幌市',yomi:'さっぽろし'},{name:'函館市',yomi:'はこだてし'},{name:'旭川市',yomi:'あさひかわし'},
    {name:'釧路市',yomi:'くしろし'},{name:'帯広市',yomi:'おびひろし'},{name:'北見市',yomi:'きたみし'},
    {name:'小樽市',yomi:'おたるし'},{name:'苫小牧市',yomi:'とまこまいし'},{name:'室蘭市',yomi:'むろらんし'},
    {name:'江別市',yomi:'えべつし'},{name:'千歳市',yomi:'ちとせし'},{name:'恵庭市',yomi:'えにわし'},
    {name:'北広島市',yomi:'きたひろしまし'},{name:'石狩市',yomi:'いしかりし'},{name:'網走市',yomi:'あばしりし'},
  ],
  '青森県': [
    {name:'青森市',yomi:'あおもりし'},{name:'弘前市',yomi:'ひろさきし'},{name:'八戸市',yomi:'はちのへし'},
    {name:'黒石市',yomi:'くろいしし'},{name:'五所川原市',yomi:'ごしょがわらし'},{name:'十和田市',yomi:'とわだし'},
    {name:'三沢市',yomi:'みさわし'},{name:'むつ市',yomi:'むつし'},{name:'つがる市',yomi:'つがるし'},
    {name:'平川市',yomi:'ひらかわし'},
  ],
  '岩手県': [
    {name:'盛岡市',yomi:'もりおかし'},{name:'宮古市',yomi:'みやこし'},{name:'大船渡市',yomi:'おおふなとし'},
    {name:'花巻市',yomi:'はなまきし'},{name:'北上市',yomi:'きたかみし'},{name:'久慈市',yomi:'くじし'},
    {name:'遠野市',yomi:'とおのし'},{name:'一関市',yomi:'いちのせきし'},{name:'陸前高田市',yomi:'りくぜんたかたし'},
    {name:'釜石市',yomi:'かまいしし'},{name:'奥州市',yomi:'おうしゅうし'},{name:'滝沢市',yomi:'たきざわし'},
  ],
  '宮城県': [
    {name:'仙台市',yomi:'せんだいし'},{name:'石巻市',yomi:'いしのまきし'},{name:'塩竈市',yomi:'しおがまし'},
    {name:'気仙沼市',yomi:'けせんぬまし'},{name:'白石市',yomi:'しろいしし'},{name:'名取市',yomi:'なとりし'},
    {name:'角田市',yomi:'かくだし'},{name:'多賀城市',yomi:'たがじょうし'},{name:'岩沼市',yomi:'いわぬまし'},
    {name:'登米市',yomi:'とめし'},{name:'栗原市',yomi:'くりはらし'},{name:'大崎市',yomi:'おおさきし'},
    {name:'富谷市',yomi:'とみやし'},
  ],
  '秋田県': [
    {name:'秋田市',yomi:'あきたし'},{name:'能代市',yomi:'のしろし'},{name:'横手市',yomi:'よこてし'},
    {name:'大館市',yomi:'おおだてし'},{name:'男鹿市',yomi:'おがし'},{name:'湯沢市',yomi:'ゆざわし'},
    {name:'鹿角市',yomi:'かづのし'},{name:'由利本荘市',yomi:'ゆりほんじょうし'},{name:'潟上市',yomi:'かたがみし'},
    {name:'大仙市',yomi:'だいせんし'},{name:'北秋田市',yomi:'きたあきたし'},{name:'にかほ市',yomi:'にかほし'},
    {name:'仙北市',yomi:'せんぼくし'},
  ],
  '山形県': [
    {name:'山形市',yomi:'やまがたし'},{name:'米沢市',yomi:'よねざわし'},{name:'鶴岡市',yomi:'つるおかし'},
    {name:'酒田市',yomi:'さかたし'},{name:'新庄市',yomi:'しんじょうし'},{name:'寒河江市',yomi:'さがえし'},
    {name:'上山市',yomi:'かみのやまし'},{name:'村山市',yomi:'むらやまし'},{name:'長井市',yomi:'ながいし'},
    {name:'天童市',yomi:'てんどうし'},{name:'東根市',yomi:'ひがしねし'},{name:'尾花沢市',yomi:'おばなざわし'},
    {name:'南陽市',yomi:'なんようし'},
  ],
  '福島県': [
    {name:'福島市',yomi:'ふくしまし'},{name:'会津若松市',yomi:'あいづわかまつし'},{name:'郡山市',yomi:'こおりやまし'},
    {name:'いわき市',yomi:'いわきし'},{name:'白河市',yomi:'しらかわし'},{name:'須賀川市',yomi:'すかがわし'},
    {name:'喜多方市',yomi:'きたかたし'},{name:'相馬市',yomi:'そうまし'},{name:'二本松市',yomi:'にほんまつし'},
    {name:'田村市',yomi:'たむらし'},{name:'南相馬市',yomi:'みなみそうまし'},{name:'伊達市',yomi:'だてし'},
    {name:'本宮市',yomi:'もとみやし'},
  ],
  '茨城県': [
    {name:'水戸市',yomi:'みとし'},{name:'日立市',yomi:'ひたちし'},{name:'土浦市',yomi:'つちうらし'},
    {name:'古河市',yomi:'こがし'},{name:'石岡市',yomi:'いしおかし'},{name:'結城市',yomi:'ゆうきし'},
    {name:'龍ケ崎市',yomi:'りゅうがさきし'},{name:'常総市',yomi:'じょうそうし'},{name:'常陸太田市',yomi:'ひたちおおたし'},
    {name:'高萩市',yomi:'たかはぎし'},{name:'北茨城市',yomi:'きたいばらきし'},{name:'笠間市',yomi:'かさまし'},
    {name:'取手市',yomi:'とりでし'},{name:'つくば市',yomi:'つくばし'},{name:'ひたちなか市',yomi:'ひたちなかし'},
    {name:'筑西市',yomi:'ちくせいし'},{name:'坂東市',yomi:'ばんどうし'},
  ],
  '栃木県': [
    {name:'宇都宮市',yomi:'うつのみやし'},{name:'足利市',yomi:'あしかがし'},{name:'栃木市',yomi:'とちぎし'},
    {name:'佐野市',yomi:'さのし'},{name:'鹿沼市',yomi:'かぬまし'},{name:'日光市',yomi:'にっこうし'},
    {name:'小山市',yomi:'おやまし'},{name:'真岡市',yomi:'もおかし'},{name:'大田原市',yomi:'おおたわらし'},
    {name:'矢板市',yomi:'やいたし'},{name:'那須塩原市',yomi:'なすしおばらし'},{name:'さくら市',yomi:'さくらし'},
    {name:'那須烏山市',yomi:'なすからすやまし'},{name:'下野市',yomi:'しもつけし'},
  ],
  '群馬県': [
    {name:'前橋市',yomi:'まえばしし'},{name:'高崎市',yomi:'たかさきし'},{name:'桐生市',yomi:'きりゅうし'},
    {name:'伊勢崎市',yomi:'いせさきし'},{name:'太田市',yomi:'おおたし'},{name:'沼田市',yomi:'ぬまたし'},
    {name:'館林市',yomi:'たてばやしし'},{name:'渋川市',yomi:'しぶかわし'},{name:'藤岡市',yomi:'ふじおかし'},
    {name:'富岡市',yomi:'とみおかし'},{name:'安中市',yomi:'あんなかし'},{name:'みどり市',yomi:'みどりし'},
  ],
  '埼玉県': [
    {name:'さいたま市',yomi:'さいたまし'},{name:'川越市',yomi:'かわごえし'},{name:'熊谷市',yomi:'くまがやし'},
    {name:'川口市',yomi:'かわぐちし'},{name:'秩父市',yomi:'ちちぶし'},{name:'所沢市',yomi:'ところざわし'},
    {name:'飯能市',yomi:'はんのうし'},{name:'加須市',yomi:'かぞし'},{name:'本庄市',yomi:'ほんじょうし'},
    {name:'東松山市',yomi:'ひがしまつやまし'},{name:'春日部市',yomi:'かすかべし'},{name:'狭山市',yomi:'さやまし'},
    {name:'羽生市',yomi:'はにゅうし'},{name:'鴻巣市',yomi:'こうのすし'},{name:'深谷市',yomi:'ふかやし'},
    {name:'上尾市',yomi:'あげおし'},{name:'草加市',yomi:'そうかし'},{name:'越谷市',yomi:'こしがやし'},
    {name:'蕨市',yomi:'わらびし'},{name:'戸田市',yomi:'とだし'},{name:'入間市',yomi:'いるまし'},
    {name:'朝霞市',yomi:'あさかし'},{name:'志木市',yomi:'しきし'},{name:'和光市',yomi:'わこうし'},
    {name:'新座市',yomi:'にいざし'},{name:'桶川市',yomi:'おけがわし'},{name:'久喜市',yomi:'くきし'},
    {name:'北本市',yomi:'きたもとし'},{name:'八潮市',yomi:'やしおし'},{name:'富士見市',yomi:'ふじみし'},
    {name:'三郷市',yomi:'みさとし'},{name:'坂戸市',yomi:'さかどし'},{name:'幸手市',yomi:'さってし'},
    {name:'鶴ヶ島市',yomi:'つるがしまし'},{name:'日高市',yomi:'ひだかし'},{name:'吉川市',yomi:'よしかわし'},
    {name:'ふじみ野市',yomi:'ふじみのし'},{name:'白岡市',yomi:'しらおかし'},
  ],
  '千葉県': [
    {name:'千葉市',yomi:'ちばし'},{name:'銚子市',yomi:'ちょうしし'},{name:'市川市',yomi:'いちかわし'},
    {name:'船橋市',yomi:'ふなばしし'},{name:'館山市',yomi:'たてやまし'},{name:'木更津市',yomi:'きさらづし'},
    {name:'松戸市',yomi:'まつどし'},{name:'野田市',yomi:'のだし'},{name:'茂原市',yomi:'もばらし'},
    {name:'成田市',yomi:'なりたし'},{name:'佐倉市',yomi:'さくらし'},{name:'習志野市',yomi:'ならしのし'},
    {name:'柏市',yomi:'かしわし'},{name:'市原市',yomi:'いちはらし'},{name:'流山市',yomi:'ながれやまし'},
    {name:'八千代市',yomi:'やちよし'},{name:'我孫子市',yomi:'あびこし'},{name:'鎌ケ谷市',yomi:'かまがやし'},
    {name:'君津市',yomi:'きみつし'},{name:'浦安市',yomi:'うらやすし'},{name:'四街道市',yomi:'よつかいどうし'},
    {name:'袖ケ浦市',yomi:'そでがうらし'},{name:'八街市',yomi:'やちまたし'},{name:'印西市',yomi:'いんざいし'},
    {name:'白井市',yomi:'しろいし'},{name:'富里市',yomi:'とみさとし'},{name:'南房総市',yomi:'みなみぼうそうし'},
    {name:'香取市',yomi:'かとりし'},{name:'山武市',yomi:'さんむし'},{name:'いすみ市',yomi:'いすみし'},
    {name:'大網白里市',yomi:'おおあみしらさとし'},
  ],
  '東京都': [
    {name:'千代田区',yomi:'ちよだく'},{name:'中央区',yomi:'ちゅうおうく'},{name:'港区',yomi:'みなとく'},
    {name:'新宿区',yomi:'しんじゅくく'},{name:'文京区',yomi:'ぶんきょうく'},{name:'台東区',yomi:'たいとうく'},
    {name:'墨田区',yomi:'すみだく'},{name:'江東区',yomi:'こうとうく'},{name:'品川区',yomi:'しながわく'},
    {name:'目黒区',yomi:'めぐろく'},{name:'大田区',yomi:'おおたく'},{name:'世田谷区',yomi:'せたがやく'},
    {name:'渋谷区',yomi:'しぶやく'},{name:'中野区',yomi:'なかのく'},{name:'杉並区',yomi:'すぎなみく'},
    {name:'豊島区',yomi:'としまく'},{name:'北区',yomi:'きたく'},{name:'荒川区',yomi:'あらかわく'},
    {name:'板橋区',yomi:'いたばしく'},{name:'練馬区',yomi:'ねりまく'},{name:'足立区',yomi:'あだちく'},
    {name:'葛飾区',yomi:'かつしかく'},{name:'江戸川区',yomi:'えどがわく'},
    {name:'八王子市',yomi:'はちおうじし'},{name:'立川市',yomi:'たちかわし'},{name:'武蔵野市',yomi:'むさしのし'},
    {name:'三鷹市',yomi:'みたかし'},{name:'青梅市',yomi:'おうめし'},{name:'府中市',yomi:'ふちゅうし'},
    {name:'昭島市',yomi:'あきしまし'},{name:'調布市',yomi:'ちょうふし'},{name:'町田市',yomi:'まちだし'},
    {name:'小金井市',yomi:'こがねいし'},{name:'小平市',yomi:'こだいらし'},{name:'日野市',yomi:'ひのし'},
    {name:'東村山市',yomi:'ひがしむらやまし'},{name:'国分寺市',yomi:'こくぶんじし'},{name:'国立市',yomi:'くにたちし'},
    {name:'福生市',yomi:'ふっさし'},{name:'狛江市',yomi:'こまえし'},{name:'東大和市',yomi:'ひがしやまとし'},
    {name:'清瀬市',yomi:'きよせし'},{name:'東久留米市',yomi:'ひがしくるめし'},{name:'多摩市',yomi:'たまし'},
    {name:'稲城市',yomi:'いなぎし'},{name:'羽村市',yomi:'はむらし'},{name:'あきる野市',yomi:'あきるのし'},
    {name:'西東京市',yomi:'にしとうきょうし'},
  ],
  '神奈川県': [
    {name:'横浜市',yomi:'よこはまし'},{name:'川崎市',yomi:'かわさきし'},{name:'相模原市',yomi:'さがみはらし'},
    {name:'横須賀市',yomi:'よこすかし'},{name:'平塚市',yomi:'ひらつかし'},{name:'鎌倉市',yomi:'かまくらし'},
    {name:'藤沢市',yomi:'ふじさわし'},{name:'小田原市',yomi:'おだわらし'},{name:'茅ヶ崎市',yomi:'ちがさきし'},
    {name:'逗子市',yomi:'ずしし'},{name:'三浦市',yomi:'みうらし'},{name:'秦野市',yomi:'はだのし'},
    {name:'厚木市',yomi:'あつぎし'},{name:'大和市',yomi:'やまとし'},{name:'伊勢原市',yomi:'いせはらし'},
    {name:'海老名市',yomi:'えびなし'},{name:'座間市',yomi:'ざまし'},{name:'南足柄市',yomi:'みなみあしがらし'},
    {name:'綾瀬市',yomi:'あやせし'},
  ],
  '新潟県': [
    {name:'新潟市',yomi:'にいがたし'},{name:'長岡市',yomi:'ながおかし'},{name:'三条市',yomi:'さんじょうし'},
    {name:'柏崎市',yomi:'かしわざきし'},{name:'新発田市',yomi:'しばたし'},{name:'小千谷市',yomi:'おぢやし'},
    {name:'加茂市',yomi:'かもし'},{name:'十日町市',yomi:'とおかまちし'},{name:'見附市',yomi:'みつけし'},
    {name:'村上市',yomi:'むらかみし'},{name:'燕市',yomi:'つばめし'},{name:'糸魚川市',yomi:'いといがわし'},
    {name:'妙高市',yomi:'みょうこうし'},{name:'五泉市',yomi:'ごせんし'},{name:'上越市',yomi:'じょうえつし'},
    {name:'阿賀野市',yomi:'あがのし'},{name:'佐渡市',yomi:'さどし'},{name:'魚沼市',yomi:'うおぬまし'},
    {name:'南魚沼市',yomi:'みなみうおぬまし'},{name:'胎内市',yomi:'たいないし'},
  ],
  '富山県': [
    {name:'富山市',yomi:'とやまし'},{name:'高岡市',yomi:'たかおかし'},{name:'魚津市',yomi:'うおづし'},
    {name:'氷見市',yomi:'ひみし'},{name:'滑川市',yomi:'なめりかわし'},{name:'黒部市',yomi:'くろべし'},
    {name:'砺波市',yomi:'となみし'},{name:'小矢部市',yomi:'おやべし'},{name:'南砺市',yomi:'なんとし'},
    {name:'射水市',yomi:'いみずし'},
  ],
  '石川県': [
    {name:'金沢市',yomi:'かなざわし'},{name:'七尾市',yomi:'ななおし'},{name:'小松市',yomi:'こまつし'},
    {name:'輪島市',yomi:'わじまし'},{name:'珠洲市',yomi:'すずし'},{name:'加賀市',yomi:'かがし'},
    {name:'羽咋市',yomi:'はくいし'},{name:'かほく市',yomi:'かほくし'},{name:'白山市',yomi:'はくさんし'},
    {name:'能美市',yomi:'のみし'},{name:'野々市市',yomi:'ののいちし'},
  ],
  '福井県': [
    {name:'福井市',yomi:'ふくいし'},{name:'敦賀市',yomi:'つるがし'},{name:'小浜市',yomi:'おばまし'},
    {name:'大野市',yomi:'おおのし'},{name:'勝山市',yomi:'かつやまし'},{name:'鯖江市',yomi:'さばえし'},
    {name:'あわら市',yomi:'あわらし'},{name:'越前市',yomi:'えちぜんし'},{name:'坂井市',yomi:'さかいし'},
  ],
  '山梨県': [
    {name:'甲府市',yomi:'こうふし'},{name:'富士吉田市',yomi:'ふじよしだし'},{name:'都留市',yomi:'つるし'},
    {name:'山梨市',yomi:'やまなしし'},{name:'大月市',yomi:'おおつきし'},{name:'韮崎市',yomi:'にらさきし'},
    {name:'南アルプス市',yomi:'みなみあるぷすし'},{name:'北杜市',yomi:'ほくとし'},{name:'甲斐市',yomi:'かいし'},
    {name:'笛吹市',yomi:'ふえふきし'},{name:'上野原市',yomi:'うえのはらし'},{name:'甲州市',yomi:'こうしゅうし'},
    {name:'中央市',yomi:'ちゅうおうし'},
  ],
  '長野県': [
    {name:'長野市',yomi:'ながのし'},{name:'松本市',yomi:'まつもとし'},{name:'上田市',yomi:'うえだし'},
    {name:'岡谷市',yomi:'おかやし'},{name:'飯田市',yomi:'いいだし'},{name:'諏訪市',yomi:'すわし'},
    {name:'須坂市',yomi:'すざかし'},{name:'小諸市',yomi:'こもろし'},{name:'伊那市',yomi:'いなし'},
    {name:'駒ヶ根市',yomi:'こまがねし'},{name:'中野市',yomi:'なかのし'},{name:'大町市',yomi:'おおまちし'},
    {name:'飯山市',yomi:'いいやまし'},{name:'茅野市',yomi:'ちのし'},{name:'塩尻市',yomi:'しおじりし'},
    {name:'佐久市',yomi:'さくし'},{name:'千曲市',yomi:'ちくまし'},{name:'東御市',yomi:'とうみし'},
    {name:'安曇野市',yomi:'あづみのし'},
  ],
  '岐阜県': [
    {name:'岐阜市',yomi:'ぎふし'},{name:'大垣市',yomi:'おおがきし'},{name:'高山市',yomi:'たかやまし'},
    {name:'多治見市',yomi:'たじみし'},{name:'関市',yomi:'せきし'},{name:'中津川市',yomi:'なかつがわし'},
    {name:'美濃市',yomi:'みのし'},{name:'瑞浪市',yomi:'みずなみし'},{name:'羽島市',yomi:'はしまし'},
    {name:'恵那市',yomi:'えなし'},{name:'美濃加茂市',yomi:'みのかもし'},{name:'土岐市',yomi:'ときし'},
    {name:'各務原市',yomi:'かかみがはらし'},{name:'可児市',yomi:'かにし'},{name:'山県市',yomi:'やまがたし'},
    {name:'瑞穂市',yomi:'みずほし'},{name:'飛騨市',yomi:'ひだし'},{name:'本巣市',yomi:'もとすし'},
    {name:'郡上市',yomi:'ぐじょうし'},{name:'下呂市',yomi:'げろし'},{name:'海津市',yomi:'かいづし'},
  ],
  '静岡県': [
    {name:'静岡市',yomi:'しずおかし'},{name:'浜松市',yomi:'はままつし'},{name:'沼津市',yomi:'ぬまづし'},
    {name:'熱海市',yomi:'あたみし'},{name:'三島市',yomi:'みしまし'},{name:'富士宮市',yomi:'ふじのみやし'},
    {name:'伊東市',yomi:'いとうし'},{name:'島田市',yomi:'しまだし'},{name:'富士市',yomi:'ふじし'},
    {name:'磐田市',yomi:'いわたし'},{name:'焼津市',yomi:'やいづし'},{name:'掛川市',yomi:'かけがわし'},
    {name:'藤枝市',yomi:'ふじえだし'},{name:'御殿場市',yomi:'ごてんばし'},{name:'袋井市',yomi:'ふくろいし'},
    {name:'下田市',yomi:'しもだし'},{name:'裾野市',yomi:'すそのし'},{name:'湖西市',yomi:'こさいし'},
    {name:'伊豆市',yomi:'いずし'},{name:'御前崎市',yomi:'おまえざきし'},{name:'菊川市',yomi:'きくがわし'},
    {name:'伊豆の国市',yomi:'いずのくにし'},{name:'牧之原市',yomi:'まきのはらし'},
  ],
  '愛知県': [
    {name:'名古屋市',yomi:'なごやし'},{name:'豊橋市',yomi:'とよはしし'},{name:'岡崎市',yomi:'おかざきし'},
    {name:'一宮市',yomi:'いちのみやし'},{name:'瀬戸市',yomi:'せとし'},{name:'半田市',yomi:'はんだし'},
    {name:'春日井市',yomi:'かすがいし'},{name:'豊川市',yomi:'とよかわし'},{name:'津島市',yomi:'つしまし'},
    {name:'碧南市',yomi:'へきなんし'},{name:'刈谷市',yomi:'かりやし'},{name:'豊田市',yomi:'とよたし'},
    {name:'安城市',yomi:'あんじょうし'},{name:'西尾市',yomi:'にしおし'},{name:'蒲郡市',yomi:'がまごおりし'},
    {name:'犬山市',yomi:'いぬやまし'},{name:'常滑市',yomi:'とこなめし'},{name:'江南市',yomi:'こうなんし'},
    {name:'小牧市',yomi:'こまきし'},{name:'稲沢市',yomi:'いなざわし'},{name:'新城市',yomi:'しんしろし'},
    {name:'東海市',yomi:'とうかいし'},{name:'大府市',yomi:'おおぶし'},{name:'知多市',yomi:'ちたし'},
    {name:'知立市',yomi:'ちりゅうし'},{name:'尾張旭市',yomi:'おわりあさひし'},{name:'高浜市',yomi:'たかはまし'},
    {name:'岩倉市',yomi:'いわくらし'},{name:'豊明市',yomi:'とよあけし'},{name:'日進市',yomi:'にっしんし'},
    {name:'田原市',yomi:'たはらし'},{name:'愛西市',yomi:'あいさいし'},{name:'清須市',yomi:'きよすし'},
    {name:'北名古屋市',yomi:'きたなごやし'},{name:'弥富市',yomi:'やとみし'},{name:'みよし市',yomi:'みよしし'},
    {name:'あま市',yomi:'あまし'},{name:'長久手市',yomi:'ながくてし'},
  ],
  '三重県': [
    {name:'津市',yomi:'つし'},{name:'四日市市',yomi:'よっかいちし'},{name:'伊勢市',yomi:'いせし'},
    {name:'松阪市',yomi:'まつさかし'},{name:'桑名市',yomi:'くわなし'},{name:'鈴鹿市',yomi:'すずかし'},
    {name:'名張市',yomi:'なばりし'},{name:'尾鷲市',yomi:'おわせし'},{name:'亀山市',yomi:'かめやまし'},
    {name:'鳥羽市',yomi:'とばし'},{name:'熊野市',yomi:'くまのし'},{name:'いなべ市',yomi:'いなべし'},
    {name:'志摩市',yomi:'しまし'},{name:'伊賀市',yomi:'いがし'},
  ],
  '滋賀県': [
    {name:'大津市',yomi:'おおつし'},{name:'彦根市',yomi:'ひこねし'},{name:'長浜市',yomi:'ながはまし'},
    {name:'近江八幡市',yomi:'おうみはちまんし'},{name:'草津市',yomi:'くさつし'},{name:'守山市',yomi:'もりやまし'},
    {name:'栗東市',yomi:'りっとうし'},{name:'甲賀市',yomi:'こうかし'},{name:'野洲市',yomi:'やすし'},
    {name:'湖南市',yomi:'こなんし'},{name:'高島市',yomi:'たかしまし'},{name:'東近江市',yomi:'ひがしおうみし'},
    {name:'米原市',yomi:'まいばらし'},
  ],
  '京都府': [
    {name:'京都市',yomi:'きょうとし'},{name:'福知山市',yomi:'ふくちやまし'},{name:'舞鶴市',yomi:'まいづるし'},
    {name:'綾部市',yomi:'あやべし'},{name:'宇治市',yomi:'うじし'},{name:'宮津市',yomi:'みやづし'},
    {name:'亀岡市',yomi:'かめおかし'},{name:'城陽市',yomi:'じょうようし'},{name:'向日市',yomi:'むこうし'},
    {name:'長岡京市',yomi:'ながおかきょうし'},{name:'八幡市',yomi:'やわたし'},{name:'京田辺市',yomi:'きょうたなべし'},
    {name:'京丹後市',yomi:'きょうたんごし'},{name:'南丹市',yomi:'なんたんし'},{name:'木津川市',yomi:'きづがわし'},
  ],
  '大阪府': [
    {name:'大阪市',yomi:'おおさかし'},{name:'堺市',yomi:'さかいし'},{name:'岸和田市',yomi:'きしわだし'},
    {name:'豊中市',yomi:'とよなかし'},{name:'池田市',yomi:'いけだし'},{name:'吹田市',yomi:'すいたし'},
    {name:'泉大津市',yomi:'いずみおおつし'},{name:'高槻市',yomi:'たかつきし'},{name:'貝塚市',yomi:'かいづかし'},
    {name:'守口市',yomi:'もりぐちし'},{name:'枚方市',yomi:'ひらかたし'},{name:'茨木市',yomi:'いばらきし'},
    {name:'八尾市',yomi:'やおし'},{name:'泉佐野市',yomi:'いずみさのし'},{name:'富田林市',yomi:'とんだばやしし'},
    {name:'寝屋川市',yomi:'ねやがわし'},{name:'河内長野市',yomi:'かわちながのし'},{name:'松原市',yomi:'まつばらし'},
    {name:'大東市',yomi:'だいとうし'},{name:'和泉市',yomi:'いずみし'},{name:'箕面市',yomi:'みのおし'},
    {name:'柏原市',yomi:'かしわらし'},{name:'羽曳野市',yomi:'はびきのし'},{name:'門真市',yomi:'かどまし'},
    {name:'摂津市',yomi:'せっつし'},{name:'高石市',yomi:'たかいしし'},{name:'藤井寺市',yomi:'ふじいでらし'},
    {name:'東大阪市',yomi:'ひがしおおさかし'},{name:'泉南市',yomi:'せんなんし'},{name:'四條畷市',yomi:'しじょうなわてし'},
    {name:'交野市',yomi:'かたのし'},{name:'大阪狭山市',yomi:'おおさかさやまし'},{name:'阪南市',yomi:'はんなんし'},
  ],
  '兵庫県': [
    {name:'神戸市',yomi:'こうべし'},{name:'姫路市',yomi:'ひめじし'},{name:'尼崎市',yomi:'あまがさきし'},
    {name:'明石市',yomi:'あかしし'},{name:'西宮市',yomi:'にしのみやし'},{name:'洲本市',yomi:'すもとし'},
    {name:'芦屋市',yomi:'あしやし'},{name:'伊丹市',yomi:'いたみし'},{name:'相生市',yomi:'あいおいし'},
    {name:'豊岡市',yomi:'とよおかし'},{name:'加古川市',yomi:'かこがわし'},{name:'赤穂市',yomi:'あこうし'},
    {name:'西脇市',yomi:'にしわきし'},{name:'宝塚市',yomi:'たからづかし'},{name:'三木市',yomi:'みきし'},
    {name:'高砂市',yomi:'たかさごし'},{name:'川西市',yomi:'かわにしし'},{name:'小野市',yomi:'おのし'},
    {name:'三田市',yomi:'さんだし'},{name:'加西市',yomi:'かさいし'},{name:'丹波篠山市',yomi:'たんばささやまし'},
    {name:'養父市',yomi:'やぶし'},{name:'丹波市',yomi:'たんばし'},{name:'南あわじ市',yomi:'みなみあわじし'},
    {name:'朝来市',yomi:'あさごし'},{name:'淡路市',yomi:'あわじし'},{name:'宍粟市',yomi:'しそうし'},
    {name:'加東市',yomi:'かとうし'},{name:'たつの市',yomi:'たつのし'},
  ],
  '奈良県': [
    {name:'奈良市',yomi:'ならし'},{name:'大和高田市',yomi:'やまとたかだし'},{name:'大和郡山市',yomi:'やまとこおりやまし'},
    {name:'天理市',yomi:'てんりし'},{name:'橿原市',yomi:'かしはらし'},{name:'桜井市',yomi:'さくらいし'},
    {name:'五條市',yomi:'ごじょうし'},{name:'御所市',yomi:'ごせし'},{name:'生駒市',yomi:'いこまし'},
    {name:'香芝市',yomi:'かしばし'},{name:'葛城市',yomi:'かつらぎし'},{name:'宇陀市',yomi:'うだし'},
  ],
  '和歌山県': [
    {name:'和歌山市',yomi:'わかやまし'},{name:'海南市',yomi:'かいなんし'},{name:'橋本市',yomi:'はしもとし'},
    {name:'有田市',yomi:'ありだし'},{name:'御坊市',yomi:'ごぼうし'},{name:'田辺市',yomi:'たなべし'},
    {name:'新宮市',yomi:'しんぐうし'},{name:'紀の川市',yomi:'きのかわし'},{name:'岩出市',yomi:'いわでし'},
  ],
  '鳥取県': [
    {name:'鳥取市',yomi:'とっとりし'},{name:'米子市',yomi:'よなごし'},{name:'倉吉市',yomi:'くらよしし'},
    {name:'境港市',yomi:'さかいみなとし'},
  ],
  '島根県': [
    {name:'松江市',yomi:'まつえし'},{name:'浜田市',yomi:'はまだし'},{name:'出雲市',yomi:'いずもし'},
    {name:'益田市',yomi:'ますだし'},{name:'大田市',yomi:'おおだし'},{name:'安来市',yomi:'やすぎし'},
    {name:'江津市',yomi:'ごうつし'},{name:'雲南市',yomi:'うんなんし'},
  ],
  '岡山県': [
    {name:'岡山市',yomi:'おかやまし'},{name:'倉敷市',yomi:'くらしきし'},{name:'津山市',yomi:'つやまし'},
    {name:'玉野市',yomi:'たまのし'},{name:'笠岡市',yomi:'かさおかし'},{name:'井原市',yomi:'いばらし'},
    {name:'総社市',yomi:'そうじゃし'},{name:'高梁市',yomi:'たかはしし'},{name:'新見市',yomi:'にいみし'},
    {name:'備前市',yomi:'びぜんし'},{name:'瀬戸内市',yomi:'せとうちし'},{name:'赤磐市',yomi:'あかいわし'},
    {name:'真庭市',yomi:'まにわし'},{name:'美作市',yomi:'みまさかし'},{name:'浅口市',yomi:'あさくちし'},
  ],
  '広島県': [
    {name:'広島市',yomi:'ひろしまし'},{name:'呉市',yomi:'くれし'},{name:'竹原市',yomi:'たけはらし'},
    {name:'三原市',yomi:'みはらし'},{name:'尾道市',yomi:'おのみちし'},{name:'福山市',yomi:'ふくやまし'},
    {name:'府中市',yomi:'ふちゅうし'},{name:'三次市',yomi:'みよしし'},{name:'庄原市',yomi:'しょうばらし'},
    {name:'大竹市',yomi:'おおたけし'},{name:'東広島市',yomi:'ひがしひろしまし'},{name:'廿日市市',yomi:'はつかいちし'},
    {name:'安芸高田市',yomi:'あきたかたし'},{name:'江田島市',yomi:'えたじまし'},
  ],
  '山口県': [
    {name:'下関市',yomi:'しものせきし'},{name:'宇部市',yomi:'うべし'},{name:'山口市',yomi:'やまぐちし'},
    {name:'萩市',yomi:'はぎし'},{name:'防府市',yomi:'ほうふし'},{name:'下松市',yomi:'くだまつし'},
    {name:'岩国市',yomi:'いわくにし'},{name:'光市',yomi:'ひかりし'},{name:'長門市',yomi:'ながとし'},
    {name:'柳井市',yomi:'やないし'},{name:'美祢市',yomi:'みねし'},{name:'周南市',yomi:'しゅうなんし'},
    {name:'山陽小野田市',yomi:'さんようおのだし'},
  ],
  '徳島県': [
    {name:'徳島市',yomi:'とくしまし'},{name:'鳴門市',yomi:'なるとし'},{name:'小松島市',yomi:'こまつしまし'},
    {name:'阿南市',yomi:'あなんし'},{name:'吉野川市',yomi:'よしのがわし'},{name:'阿波市',yomi:'あわし'},
    {name:'美馬市',yomi:'みまし'},{name:'三好市',yomi:'みよしし'},
  ],
  '香川県': [
    {name:'高松市',yomi:'たかまつし'},{name:'丸亀市',yomi:'まるがめし'},{name:'坂出市',yomi:'さかいでし'},
    {name:'善通寺市',yomi:'ぜんつうじし'},{name:'観音寺市',yomi:'かんおんじし'},{name:'さぬき市',yomi:'さぬきし'},
    {name:'東かがわ市',yomi:'ひがしかがわし'},{name:'三豊市',yomi:'みとよし'},
  ],
  '愛媛県': [
    {name:'松山市',yomi:'まつやまし'},{name:'今治市',yomi:'いまばりし'},{name:'宇和島市',yomi:'うわじまし'},
    {name:'八幡浜市',yomi:'やわたはまし'},{name:'新居浜市',yomi:'にいはまし'},{name:'西条市',yomi:'さいじょうし'},
    {name:'大洲市',yomi:'おおずし'},{name:'伊予市',yomi:'いよし'},{name:'四国中央市',yomi:'しこくちゅうおうし'},
    {name:'西予市',yomi:'せいよし'},{name:'東温市',yomi:'とうおんし'},
  ],
  '高知県': [
    {name:'高知市',yomi:'こうちし'},{name:'室戸市',yomi:'むろとし'},{name:'安芸市',yomi:'あきし'},
    {name:'南国市',yomi:'なんこくし'},{name:'土佐市',yomi:'とさし'},{name:'須崎市',yomi:'すさきし'},
    {name:'宿毛市',yomi:'すくもし'},{name:'土佐清水市',yomi:'とさしみずし'},{name:'四万十市',yomi:'しまんとし'},
    {name:'香南市',yomi:'こうなんし'},{name:'香美市',yomi:'かみし'},
  ],
  '福岡県': [
    {name:'福岡市',yomi:'ふくおかし'},{name:'北九州市',yomi:'きたきゅうしゅうし'},{name:'大牟田市',yomi:'おおむたし'},
    {name:'久留米市',yomi:'くるめし'},{name:'直方市',yomi:'のおがたし'},{name:'飯塚市',yomi:'いいづかし'},
    {name:'田川市',yomi:'たがわし'},{name:'柳川市',yomi:'やながわし'},{name:'八女市',yomi:'やめし'},
    {name:'筑後市',yomi:'ちくごし'},{name:'大川市',yomi:'おおかわし'},{name:'行橋市',yomi:'ゆくはしし'},
    {name:'豊前市',yomi:'ぶぜんし'},{name:'中間市',yomi:'なかまし'},{name:'小郡市',yomi:'おごおりし'},
    {name:'筑紫野市',yomi:'ちくしのし'},{name:'春日市',yomi:'かすがし'},{name:'大野城市',yomi:'おおのじょうし'},
    {name:'宗像市',yomi:'むなかたし'},{name:'太宰府市',yomi:'だざいふし'},{name:'古賀市',yomi:'こがし'},
    {name:'福津市',yomi:'ふくつし'},{name:'うきは市',yomi:'うきはし'},{name:'宮若市',yomi:'みやわかし'},
    {name:'嘉麻市',yomi:'かまし'},{name:'朝倉市',yomi:'あさくらし'},{name:'みやま市',yomi:'みやまし'},
    {name:'糸島市',yomi:'いとしまし'},{name:'那珂川市',yomi:'なかがわし'},
  ],
  '佐賀県': [
    {name:'佐賀市',yomi:'さがし'},{name:'唐津市',yomi:'からつし'},{name:'鳥栖市',yomi:'とすし'},
    {name:'多久市',yomi:'たくし'},{name:'伊万里市',yomi:'いまりし'},{name:'武雄市',yomi:'たけおし'},
    {name:'鹿島市',yomi:'かしまし'},{name:'小城市',yomi:'おぎし'},{name:'嬉野市',yomi:'うれしのし'},
    {name:'神埼市',yomi:'かんざきし'},
  ],
  '長崎県': [
    {name:'長崎市',yomi:'ながさきし'},{name:'佐世保市',yomi:'させぼし'},{name:'島原市',yomi:'しまばらし'},
    {name:'諫早市',yomi:'いさはやし'},{name:'大村市',yomi:'おおむらし'},{name:'平戸市',yomi:'ひらどし'},
    {name:'松浦市',yomi:'まつうらし'},{name:'対馬市',yomi:'つしまし'},{name:'壱岐市',yomi:'いきし'},
    {name:'五島市',yomi:'ごとうし'},{name:'西海市',yomi:'さいかいし'},{name:'雲仙市',yomi:'うんぜんし'},
    {name:'南島原市',yomi:'みなみしまばらし'},
  ],
  '熊本県': [
    {name:'熊本市',yomi:'くまもとし'},{name:'八代市',yomi:'やつしろし'},{name:'人吉市',yomi:'ひとよしし'},
    {name:'荒尾市',yomi:'あらおし'},{name:'水俣市',yomi:'みなまたし'},{name:'玉名市',yomi:'たまなし'},
    {name:'山鹿市',yomi:'やまがし'},{name:'菊池市',yomi:'きくちし'},{name:'宇土市',yomi:'うとし'},
    {name:'上天草市',yomi:'かみあまくさし'},{name:'宇城市',yomi:'うきし'},{name:'阿蘇市',yomi:'あそし'},
    {name:'天草市',yomi:'あまくさし'},{name:'合志市',yomi:'こうしし'},
  ],
  '大分県': [
    {name:'大分市',yomi:'おおいたし'},{name:'別府市',yomi:'べっぷし'},{name:'中津市',yomi:'なかつし'},
    {name:'日田市',yomi:'ひたし'},{name:'佐伯市',yomi:'さいきし'},{name:'臼杵市',yomi:'うすきし'},
    {name:'津久見市',yomi:'つくみし'},{name:'竹田市',yomi:'たけたし'},{name:'豊後高田市',yomi:'ぶんごたかだし'},
    {name:'杵築市',yomi:'きつきし'},{name:'宇佐市',yomi:'うさし'},{name:'豊後大野市',yomi:'ぶんごおおのし'},
    {name:'由布市',yomi:'ゆふし'},{name:'国東市',yomi:'くにさきし'},
  ],
  '宮崎県': [
    {name:'宮崎市',yomi:'みやざきし'},{name:'都城市',yomi:'みやこのじょうし'},{name:'延岡市',yomi:'のべおかし'},
    {name:'日南市',yomi:'にちなんし'},{name:'小林市',yomi:'こばやしし'},{name:'日向市',yomi:'ひゅうがし'},
    {name:'串間市',yomi:'くしまし'},{name:'西都市',yomi:'さいとし'},{name:'えびの市',yomi:'えびのし'},
  ],
  '鹿児島県': [
    {name:'鹿児島市',yomi:'かごしまし'},{name:'鹿屋市',yomi:'かのやし'},{name:'枕崎市',yomi:'まくらざきし'},
    {name:'阿久根市',yomi:'あくねし'},{name:'出水市',yomi:'いずみし'},{name:'指宿市',yomi:'いぶすきし'},
    {name:'西之表市',yomi:'にしのおもてし'},{name:'垂水市',yomi:'たるみずし'},{name:'薩摩川内市',yomi:'さつませんだいし'},
    {name:'日置市',yomi:'ひおきし'},{name:'曽於市',yomi:'そおし'},{name:'霧島市',yomi:'きりしまし'},
    {name:'いちき串木野市',yomi:'いちきくしきのし'},{name:'南さつま市',yomi:'みなみさつまし'},{name:'志布志市',yomi:'しぶしし'},
    {name:'奄美市',yomi:'あまみし'},{name:'南九州市',yomi:'みなみきゅうしゅうし'},{name:'伊佐市',yomi:'いさし'},
    {name:'姶良市',yomi:'あいらし'},
  ],
  '沖縄県': [
    {name:'那覇市',yomi:'なはし'},{name:'宜野湾市',yomi:'ぎのわんし'},{name:'石垣市',yomi:'いしがきし'},
    {name:'浦添市',yomi:'うらそえし'},{name:'名護市',yomi:'なごし'},{name:'糸満市',yomi:'いとまんし'},
    {name:'沖縄市',yomi:'おきなわし'},{name:'豊見城市',yomi:'とみぐすくし'},{name:'うるま市',yomi:'うるまし'},
    {name:'宮古島市',yomi:'みやこじまし'},{name:'南城市',yomi:'なんじょうし'},
  ],
};

// ============================================================
// フィルタリング（ひらがな前方一致 > 漢字前方一致 > 部分一致）
// ============================================================
function locFilter(items, query) {
  if (!query) return items;
  const q = query.trim();
  if (!q) return items;
  const startsWith = items.filter(it => it.name.startsWith(q) || it.yomi.startsWith(q));
  const includes  = items.filter(it => !it.name.startsWith(q) && !it.yomi.startsWith(q)
                                     && (it.name.includes(q) || it.yomi.includes(q)));
  return [...startsWith, ...includes];
}

// ============================================================
// 単体オートコンプリートウィジェット
// ============================================================
function createAutocomplete({ container, items, placeholder, onSelect }) {
  const input = document.createElement('input');
  input.className = 'input loc-input';
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-autocomplete', 'list');

  const list = document.createElement('ul');
  list.className = 'loc-dropdown';
  list.setAttribute('role', 'listbox');

  container.appendChild(input);
  container.appendChild(list);

  let activeIdx = -1;
  let currentItems = [];
  let currentItemPool = items; // 差し替え可能なプール

  function renderList(filtered) {
    currentItems = filtered;
    activeIdx = -1;
    list.innerHTML = '';
    if (filtered.length === 0) {
      list.classList.remove('loc-dropdown--open');
      input.setAttribute('aria-expanded', 'false');
      return;
    }
    filtered.slice(0, 60).forEach((item, i) => {
      const li = document.createElement('li');
      li.className = 'loc-option';
      li.setAttribute('role', 'option');
      li.textContent = item.name;
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        select(item);
      });
      list.appendChild(li);
    });
    list.classList.add('loc-dropdown--open');
    input.setAttribute('aria-expanded', 'true');
  }

  function setActive(idx) {
    const opts = list.querySelectorAll('.loc-option');
    opts.forEach((el, i) => el.classList.toggle('loc-option--active', i === idx));
    if (opts[idx]) opts[idx].scrollIntoView({ block: 'nearest' });
    activeIdx = idx;
  }

  function select(item) {
    input.value = item.name;
    list.classList.remove('loc-dropdown--open');
    input.setAttribute('aria-expanded', 'false');
    activeIdx = -1;
    if (onSelect) onSelect(item);
  }

  function openList() {
    const filtered = locFilter(currentItemPool, input.value);
    renderList(filtered.length > 0 || input.value ? filtered : currentItemPool.slice(0, 60));
  }

  input.addEventListener('input', () => {
    const filtered = locFilter(currentItemPool, input.value);
    renderList(filtered);
    if (onSelect) onSelect(null);
  });

  input.addEventListener('focus', openList);

  input.addEventListener('blur', () => {
    setTimeout(() => list.classList.remove('loc-dropdown--open'), 180);
  });

  input.addEventListener('keydown', (e) => {
    if (!list.classList.contains('loc-dropdown--open')) {
      if (e.key === 'ArrowDown') { openList(); return; }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive(Math.min(activeIdx + 1, list.children.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive(Math.max(activeIdx - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIdx >= 0 && currentItems[activeIdx]) select(currentItems[activeIdx]);
        break;
      case 'Escape':
        list.classList.remove('loc-dropdown--open');
        break;
    }
  });

  return {
    getValue()         { return input.value; },
    setValue(v)        { input.value = v; },
    getInput()         { return input; },
    setItemPool(pool)  { currentItemPool = pool; },
    triggerInput()     { input.dispatchEvent(new Event('input')); },
  };
}

// ============================================================
// メイン: 既存の <input id="xxx"> を都道府県＋市区町村の2段に置き換える
// ============================================================
function initLocationAutocomplete(inputId) {
  const original = document.getElementById(inputId);
  if (!original || original.dataset.locInit === '1') return;
  original.dataset.locInit = '1';

  // 元のinputをhidden化（oninput属性は残しておく）
  original.type = 'hidden';

  // ラッパー
  const wrap = document.createElement('div');
  wrap.className = 'loc-wrap';

  // 都道府県フィールド
  const prefWrap = document.createElement('div');
  prefWrap.className = 'loc-field';
  const prefLabel = document.createElement('span');
  prefLabel.className = 'loc-sublabel';
  prefLabel.textContent = '都道府県';
  prefWrap.appendChild(prefLabel);

  // 市区町村フィールド
  const cityWrap = document.createElement('div');
  cityWrap.className = 'loc-field';
  const cityLabel = document.createElement('span');
  cityLabel.className = 'loc-sublabel';
  cityLabel.textContent = '市区町村';
  cityWrap.appendChild(cityLabel);

  let selectedPref = null;

  function syncValue() {
    const pv = prefCtrl.getValue().trim();
    const cv = cityCtrl.getValue().trim();
    const combined = [pv, cv].filter(Boolean).join(' ');
    original.value = combined;
    original.dispatchEvent(new Event('input', { bubbles: true }));
  }

  const prefCtrl = createAutocomplete({
    container: prefWrap,
    items: LOC_PREFS,
    placeholder: '例: 東京都',
    onSelect(item) {
      if (item) {
        selectedPref = item.name;
        const pool = LOC_CITIES[selectedPref] || Object.values(LOC_CITIES).flat();
        cityCtrl.setItemPool(pool);
        cityCtrl.setValue('');
      } else {
        selectedPref = null;
        cityCtrl.setItemPool(Object.values(LOC_CITIES).flat());
      }
      syncValue();
    },
  });

  const cityCtrl = createAutocomplete({
    container: cityWrap,
    items: Object.values(LOC_CITIES).flat(),
    placeholder: '例: 渋谷区',
    onSelect() { syncValue(); },
  });

  // 市区町村入力時も sync
  cityCtrl.getInput().addEventListener('input', syncValue);

  wrap.appendChild(prefWrap);
  wrap.appendChild(cityWrap);
  original.insertAdjacentElement('afterend', wrap);
}

window.initLocationAutocomplete = initLocationAutocomplete;
