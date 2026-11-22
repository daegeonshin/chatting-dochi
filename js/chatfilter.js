// 어린이 채팅 안전 필터 : 나쁜 말은 ♥로 가리고, 전화번호처럼 긴 숫자도 가림
// 보낼 때와 받을 때 모두 거름 (다른 폰에서 거르지 않고 보내도 내 화면에선 가려짐)
const BAD = [
  '시발', '씨발', '시바', '씨바', '씨빨', '시벌', '씨벌', '십알', '십새', '씹', '좆', '좃', '존나', '졸라', '존내', '개새', '개색', '개세', '개쉐', '개같', '개년',
  '새끼', '섀끼', '쌔끼', '색히', '병신', '븅신', '빙신', '병쉰', '미친', '미췬', '미쳤냐', '닥쳐', '닥치', '꺼져', '지랄', '염병', '엿먹', '느금', '니미', '니애미',
  '애미', '애비', '느그', '창녀', '걸레', '찐따', '등신', '멍청이', '바보새', '죽어', '죽을래', '뒤져', '뒤질', '섹스', '야동', '자살',
  'ㅅㅂ', 'ㅆㅂ', 'ㅂㅅ', 'ㅄ', 'ㅈㄴ', 'ㅈㄹ', 'ㅁㅊ', 'ㄲㅈ', 'ㄷㅊ', 'ㅗ',
  'fuck', 'shit', 'bitch', 'damn', 'sex', 'porn', 'dick', 'pussy', 'asshole', 'fck', 'wtf',
];
const SKIP = /[\s.,!?~\-_*^'"`·:;()[\]{}<>/\\|+=@#$%&0-9]/;
const cc = n => String.fromCharCode(n);
const INVIS = new RegExp('[' + cc(0) + '-' + cc(31) + cc(0x200b) + '-' + cc(0x200f) + cc(0x202a) + '-' + cc(0x202e) + ']', 'g');

export function cleanChat(text) {
  let s = String(text || '').replace(INVIS, '').trim().slice(0, 60);
  // 긴 숫자(전화번호, 주소 번지 등) 가리기
  s = s.replace(/(\d[\s\-.]?){6,}/g, m => '#'.repeat(m.length));
  // 띄어쓰기, 기호를 끼워 넣어도 걸리도록 글자만 모아서 비교
  const chars = [], map = [];
  for (let i = 0; i < s.length; i++) if (!SKIP.test(s[i])) { chars.push(s[i].toLowerCase()); map.push(i); }
  const flat = chars.join('');
  const hide = new Array(s.length).fill(false);
  for (const w of BAD) {
    let k = flat.indexOf(w);
    while (k >= 0) {
      for (let j = k; j < k + w.length; j++) hide[map[j]] = true;
      k = flat.indexOf(w, k + 1);
    }
  }
  return [...s].map((c, i) => hide[i] ? '♥' : c).join('');
}
// 닉네임도 같은 필터 (8글자)
export const cleanName = n => cleanChat(n).slice(0, 8) || '친구';
