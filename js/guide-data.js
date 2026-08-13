const K = [
  {r:'—', c:[
    {h:'あ',k:'ア',r:'a',s:'"ah" as in father',mh:'An <strong>apple</strong>: a cross for the stem, a loop for the fruit.',mk:'An <strong>axe</strong> head with the handle slanting off.'},
    {h:'い',k:'イ',r:'i',s:'"ee" as in feet',mh:'Two <strong>icicles</strong> hanging off a gutter, one longer.',mk:'An <strong>easel</strong> leg propping up a canvas.'},
    {h:'う',k:'ウ',r:'u',s:'"oo" as in put — lips flat, not rounded',mh:'A <strong>duck</strong> in profile, beak tipped up going "oo".',mk:'A <strong>roof</strong> with a chimney — you\'re under it going "ooh".'},
    {h:'え',k:'エ',r:'e',s:'"eh" as in bed',mh:'A <strong>swan</strong>: long neck, flat back on the water.',mk:'An <strong>I-beam</strong> girder — an engineer\'s E.'},
    {h:'お',k:'オ',r:'o',s:'"oh" as in more',mh:'A <strong>golf</strong> ball flying off the tee, flag flicking right.',mk:'An <strong>oar</strong> dipping into the water.'}]},
  {r:'K', c:[
    {h:'か',k:'カ',r:'ka',s:'',mh:'A <strong>kite</strong> with the string whipping off it.',mk:'A <strong>karate</strong> chop splitting a board.'},
    {h:'き',k:'キ',r:'ki',s:'',mh:'A <strong>key</strong> with two teeth.',mk:'The same <strong>key</strong>, teeth filed flat.'},
    {h:'く',k:'ク',r:'ku',s:'',mh:'A <strong>cuckoo\'s</strong> open beak.',mk:'A <strong>croissant</strong> curl.'},
    {h:'け',k:'ケ',r:'ke',s:'',mh:'A <strong>keg</strong> with the tap on its side.',mk:'A <strong>kettle</strong> with a handle.'},
    {h:'こ',k:'コ',r:'ko',s:'',mh:'Two <strong>coins</strong> stacked flat.',mk:'A <strong>corner</strong> bracket — half a box.'}]},
  {r:'S', c:[
    {h:'さ',k:'サ',r:'sa',s:'',mh:'A <strong>sardine</strong> on a hook, crossed by the rod.',mk:'A <strong>cactus</strong> with two arms, stuck in <strong>sand</strong>.'},
    {h:'し',k:'シ',r:'shi',s:'"she"',mh:'A <strong>shoehorn</strong> curving up at the heel.',mk:'A <strong>smiley</strong> tipped left — two eyes and a wink.'},
    {h:'す',k:'ス',r:'su',s:'',mh:'A <strong>swing</strong> hanging from a looped rope.',mk:'A <strong>ski</strong> slope with a jump at the bottom.'},
    {h:'せ',k:'セ',r:'se',s:'',mh:'A <strong>seesaw</strong> on its post, tipping back.',mk:'A <strong>scythe</strong> curving to its point.'},
    {h:'そ',k:'ソ',r:'so',s:'',mh:'A zigzag <strong>stitch</strong> — sewing.',mk:'Two loose <strong>stitches</strong> of the same thread.'}]},
  {r:'T', c:[
    {h:'た',k:'タ',r:'ta',s:'',mh:'Literally a <strong>t</strong> next to an <strong>a</strong>: ta.',mk:'A luggage <strong>tag</strong> with a slash across it.'},
    {h:'ち',k:'チ',r:'chi',s:'"chee"',mh:'A <strong>cheerleader</strong> leaning back, ponytail out.',mk:'A <strong>cheap</strong> price tag — a 7 with a line through it.'},
    {h:'つ',k:'ツ',r:'tsu',s:'"tsu" — like the end of cats',mh:'A <strong>tsunami</strong> curling over.',mk:'The same wave with three <strong>droplets</strong> flying off.'},
    {h:'て',k:'テ',r:'te',s:'"teh"',mh:'A <strong>telephone</strong> pole with the wire drooping.',mk:'A <strong>TV antenna</strong> on a roof.'},
    {h:'と',k:'ト',r:'to',s:'',mh:'A <strong>toe</strong> with a splinter in it.',mk:'A <strong>totem</strong> pole with one peg.'}]},
  {r:'N', c:[
    {h:'な',k:'ナ',r:'na',s:'',mh:'A <strong>knot</strong> tied in a rope.',mk:'A <strong>knife</strong> driven through a board.'},
    {h:'に',k:'ニ',r:'ni',s:'"nee"',mh:'A <strong>needle</strong> and two stitches beside it.',mk:'Two lines — and <strong>ni</strong> means <strong>two</strong> in Japanese.'},
    {h:'ぬ',k:'ヌ',r:'nu',s:'',mh:'<strong>Noodles</strong> twirled on chopsticks, one strand escaping.',mk:'The same <strong>noodles</strong>, chopsticks crossed, no loop.'},
    {h:'ね',k:'ネ',r:'ne',s:'',mh:'A <strong>cat</strong> curled up with its tail looping (猫 = neko).',mk:'A <strong>nest</strong> wedged in a tree fork.'},
    {h:'の',k:'ノ',r:'no',s:'',mh:'The swirl of a <strong>"no entry"</strong> sign.',mk:'A single slash: <strong>no</strong>.'}]},
  {r:'H', c:[
    {h:'は',k:'ハ',r:'ha',s:'(as a particle it\'s read "wa")',mh:'A capital <strong>H</strong> with a small a — and a <strong>house</strong> with a chimney.',mk:'Two legs of someone doubled over laughing, <strong>ha ha</strong>.'},
    {h:'ひ',k:'ヒ',r:'hi',s:'"hee"',mh:'A wide <strong>grin</strong> — hee hee.',mk:'The <strong>heel</strong> of a shoe from the side.'},
    {h:'ふ',k:'フ',r:'fu',s:'soft — between f and h, no teeth on the lip',mh:'Mount <strong>Fuji</strong> with two clouds beside it.',mk:'The bare slope of <strong>Fuji</strong> in one stroke.'},
    {h:'へ',k:'ヘ',r:'he',s:'(as a particle it\'s read "e")',mh:'A <strong>hill</strong> you hike over. Same shape in both scripts.',mk:'The same <strong>hill</strong> — the one freebie in the whole chart.'},
    {h:'ほ',k:'ホ',r:'ho',s:'',mh:'The は <strong>house</strong> plus an antenna — Santa on the roof, ho ho ho.',mk:'A <strong>totem</strong> pole with two arms.'}]},
  {r:'M', c:[
    {h:'ま',k:'マ',r:'ma',s:'',mh:'<strong>Mama</strong> with two arms out and a bun in her hair.',mk:'An open <strong>mouth</strong> with the tongue showing.'},
    {h:'み',k:'ミ',r:'mi',s:'"mee"',mh:'A <strong>mermaid\'s</strong> tail curling under her.',mk:'Three strokes — and <strong>mi</strong> means <strong>three</strong> in Japanese.'},
    {h:'む',k:'ム',r:'mu',s:'',mh:'A <strong>cow</strong> face: muuu.',mk:'A <strong>muzzle</strong>, or a scoop tipped forward.'},
    {h:'め',k:'メ',r:'me',s:'"meh"',mh:'An <strong>eye</strong> with a lash — め literally means eye.',mk:'<strong>X marks the spot</strong> on a treasure map.'},
    {h:'も',k:'モ',r:'mo',s:'',mh:'A fishing hook with two <strong>more</strong> worms on it.',mk:'The same hook, straightened out.'}]},
  {r:'Y', c:[
    {h:'や',k:'ヤ',r:'ya',s:'',mh:'A <strong>yacht</strong> with mast and sail.',mk:'The same <strong>yacht</strong>, sail only.'},
    null,
    {h:'ゆ',k:'ユ',r:'yu',s:'',mh:'A <strong>yo-yo</strong> at the end of its string.',mk:'A <strong>U-magnet</strong> lying on its side.'},
    null,
    {h:'よ',k:'ヨ',r:'yo',s:'',mh:'Someone doing <strong>yoga</strong>, folded over their knees.',mk:'A <strong>comb</strong> with three teeth.'}]},
  {r:'R', c:[
    {h:'ら',k:'ラ',r:'ra',s:'between R and L — tongue taps like the d in ladder',mh:'A <strong>rabbit</strong> sitting up, one ear laid back.',mk:'A bowl of <strong>ramen</strong> on a table.'},
    {h:'り',k:'リ',r:'ri',s:'"ree"',mh:'Two banks of a <strong>river</strong>.',mk:'The same <strong>river</strong>, straightened.'},
    {h:'る',k:'ル',r:'ru',s:'',mh:'A <strong>route</strong> that loops back on itself.',mk:'Two legs <strong>running</strong> that route.'},
    {h:'れ',k:'レ',r:'re',s:'"reh"',mh:'A <strong>ribbon</strong> streaming off to the side.',mk:'A <strong>ramp</strong> — or a hockey stick.'},
    {h:'ろ',k:'ロ',r:'ro',s:'',mh:'A <strong>road</strong> with no loop — dead end.',mk:'A <strong>robot\'s</strong> square head.'}]},
  {r:'W', c:[
    {h:'わ',k:'ワ',r:'wa',s:'',mh:'A <strong>whale</strong> with a curl of spout.',mk:'An open mouth: <strong>wah!</strong>'},
    null,null,null,
    {h:'を',k:'ヲ',r:'wo',s:'pronounced "o" — only ever the object particle',mh:'An <strong>ox</strong> with horns, dragging a yoke behind it.',mk:'Essentially never used — recognise it, don\'t drill it.'}]},
  {r:'N', c:[
    {h:'ん',k:'ン',r:'n',s:'the only consonant that stands alone; it takes a full beat',mh:'A lazy cursive <strong>n</strong>.',mk:'A <strong>wink</strong> — one eye, one lash sweeping up.'},
    null,null,null,null]}
];

const TRICKY = [
  {g:['シ','ツ'],l:['shi','tsu'],p:'The whole difference is stroke direction. シ is written from the <b>left, sweeping up</b> — its marks stack down the left side. ツ comes from the <b>top, sweeping down</b> — its marks sit along the top edge.'},
  {g:['ン','ソ'],l:['n','so'],p:'Same rule as above, one mark fewer. ン sweeps <b>up from the lower left</b>. ソ comes <b>down from the upper right</b>.'},
  {g:['ぬ','め'],l:['nu','me'],p:'ぬ has the extra loop trailing off — the escaping noodle. め stops clean.'},
  {g:['る','ろ'],l:['ru','ro'],p:'る loops at the bottom, ろ doesn\'t. The route comes back; the road is a dead end.'},
  {g:['れ','わ','ね'],l:['re','wa','ne'],p:'Same body, different tail: れ flicks <b>out</b>, わ curls <b>in</b>, ね loops all the way round (the cat\'s tail).'},
  {g:['は','ほ'],l:['ha','ho'],p:'ほ has one extra crossbar — the antenna on the house.'},
  {g:['さ','き'],l:['sa','ki'],p:'き has two crossbars, さ has one. Two teeth on the key.'},
  {g:['ク','ワ','ケ'],l:['ku','wa','ke'],p:'ク comes to a sharp point at the bottom, ワ is wide and blunt, ケ has a stroke through the top.'},
  {g:['ロ','コ'],l:['ro','ko'],p:'ロ is a closed box, コ is open on the left.'},
  {g:['ア','マ'],l:['a','ma'],p:'ア\'s stroke hangs down from the <b>right</b> side; マ\'s hangs from the <b>middle</b>.'},
  {g:['ネ','ホ'],l:['ne','ho'],p:'ネ has a slanted stroke on top; ホ starts with a clean vertical cross.'},
  {g:['チ','テ'],l:['chi','te'],p:'チ has a hook at the bottom of the vertical; テ\'s vertical runs straight down.'},
  {g:['ウ','ワ'],l:['u','wa'],p:'ウ has the chimney tick on top; ワ is bare.'}
];

/* romaji -> hiragana for every syllable with an audio clip (base, voiced, combos) */
const ROM2KANA = {"a":"あ","i":"い","u":"う","e":"え","o":"お","ka":"か","ki":"き","ku":"く","ke":"け","ko":"こ","sa":"さ","shi":"し","su":"す","se":"せ","so":"そ","ta":"た","chi":"ち","tsu":"つ","te":"て","to":"と","na":"な","ni":"に","nu":"ぬ","ne":"ね","no":"の","ha":"は","hi":"ひ","fu":"ふ","he":"へ","ho":"ほ","ma":"ま","mi":"み","mu":"む","me":"め","mo":"も","ya":"や","yu":"ゆ","yo":"よ","ra":"ら","ri":"り","ru":"る","re":"れ","ro":"ろ","wa":"わ","n":"ん","ga":"が","gi":"ぎ","gu":"ぐ","ge":"げ","go":"ご","za":"ざ","ji":"じ","zu":"ず","ze":"ぜ","zo":"ぞ","da":"だ","de":"で","do":"ど","ba":"ば","bi":"び","bu":"ぶ","be":"べ","bo":"ぼ","pa":"ぱ","pi":"ぴ","pu":"ぷ","pe":"ぺ","po":"ぽ","kya":"きゃ","kyu":"きゅ","kyo":"きょ","sha":"しゃ","shu":"しゅ","sho":"しょ","cha":"ちゃ","chu":"ちゅ","cho":"ちょ","nya":"にゃ","nyu":"にゅ","nyo":"にょ","hya":"ひゃ","hyu":"ひゅ","hyo":"ひょ","mya":"みゃ","myu":"みゅ","myo":"みょ","rya":"りゃ","ryu":"りゅ","ryo":"りょ","gya":"ぎゃ","gyu":"ぎゅ","gyo":"ぎょ","ja":"じゃ","ju":"じゅ","jo":"じょ","bya":"びゃ","byu":"びゅ","byo":"びょ","pya":"ぴゃ","pyu":"ぴゅ","pyo":"ぴょ","wo":"を"};
