// 따님이 정한 선택지 그대로
export const HAIR_STYLES = [
  { id: 'twin', name: '양쪽 땋은 머리' },
  { id: 'long', name: '길게 푼 머리' },
  { id: 'pony', name: '한 개로 묶은 머리' },
  { id: 'bald', name: '대머리' },
];
export const HAIR_COLORS = [
  { id: 'red', name: '빨강', hex: 0xd9433f },
  { id: 'yellow', name: '노랑', hex: 0xf2c94c },
  { id: 'black', name: '검정', hex: 0x2e2a2b },
  { id: 'brown', name: '갈색', hex: 0x7a4a2a },
  { id: 'gray', name: '회색', hex: 0x9b9b9b },
  { id: 'white', name: '흰색', hex: 0xf4f2ec },
];
export const EYE_COLORS = [
  { id: 'darkbrown', name: '진갈색', hex: 0x4a2a12 },
  { id: 'lightbrown', name: '연갈색', hex: 0xa8743a },
  { id: 'blue', name: '파랑', hex: 0x3a7bd5 },
  { id: 'green', name: '초록', hex: 0x3aa35a },
];
// 집 색과 옷 색
export const COLORS7 = [
  { id: 'sky', name: '하늘색', hex: 0x8fd3ff },
  { id: 'red', name: '빨간색', hex: 0xff6b6b },
  { id: 'lilac', name: '연보라색', hex: 0xc9a7ff },
  { id: 'yellow', name: '노랑색', hex: 0xffd84d },
  { id: 'green', name: '초록색', hex: 0x6fcf6f },
  { id: 'blue', name: '파란색', hex: 0x4a7dff },
  { id: 'white', name: '하얀색', hex: 0xffffff },
];

export const PETS = [
  { id: 'dog', name: '강아지', emo: '🐶', colors: [['black', '검정', 0x2e2a2b], ['white', '하얀색', 0xfaf8f2]], food: '🦴', foodName: '강아지 사료', special: 'run' },
  { id: 'cat', name: '고양이', emo: '🐱', colors: [['yellow', '노란색', 0xf2b84b], ['gray', '회색', 0x9b9b9b], ['white', '흰색', 0xfaf8f2]], food: '🐟', foodName: '생선', special: 'run' },
  { id: 'chick', name: '병아리', emo: '🐥', colors: [['yellow', '노랑색', 0xffe14d], ['white', '흰색', 0xfaf8f2]], food: '🌾', foodName: '모이', special: 'run' },
  { id: 'rabbit', name: '토끼', emo: '🐰', colors: [['white', '흰색', 0xfaf8f2]], food: '🥕', foodName: '당근', special: 'run' },
  { id: 'parrot', name: '앵무새', emo: '🦜', colors: [['green', '초록색', 0x4cc35a], ['rainbow', '빨강 노랑 파랑', 0xe8433f], ['yellow', '노랑색', 0xffd84d], ['white', '흰색', 0xfaf8f2]], food: '🌻', foodName: '해바라기씨', special: 'fly' },
  { id: 'redpanda', name: '레서판다', emo: '🦊', colors: [['orange', '주황색', 0xe0702a], ['apricot', '살구색', 0xf2b48a]], food: '🎋', foodName: '대나무', special: 'climb' },
  { id: 'sloth', name: '나무늘보', emo: '🦥', colors: [['brown', '갈색', 0x9a7a5a]], food: '🍃', foodName: '나뭇잎', special: 'climb' },
];

export const VEHICLES = [
  { id: 'bike', name: '자전거', emo: '🚲', speed: 13 },
  { id: 'plane', name: '비행기', emo: '✈️', speed: 17 },
  { id: 'skate', name: '스케이트보드', emo: '🛹', speed: 10.5 },
];

// 집 꾸미기 가구
export const FURNITURE = [
  { id: 'chair', name: '의자', emo: '🪑' },
  { id: 'table', name: '탁자', emo: '🟫' },
  { id: 'sofa', name: '소파', emo: '🛋️' },
  { id: 'shelf', name: '책장', emo: '📚' },
  { id: 'plant', name: '화분', emo: '🪴' },
  { id: 'lamp', name: '스탠드', emo: '💡' },
  { id: 'rug', name: '동그란 러그', emo: '⭕' },
  { id: 'bear', name: '곰인형', emo: '🧸' },
  { id: 'wardrobe', name: '옷장', emo: '🚪' },
  { id: 'flower', name: '꽃병', emo: '💐' },
  { id: 'tv', name: 'TV', emo: '📺' },
  { id: 'piano', name: '피아노', emo: '🎹' },
  { id: 'clock', name: '괘종시계', emo: '🕰️' },
  { id: 'cushion', name: '방석', emo: '🟪' },
  { id: 'cake', name: '케이크', emo: '🎂' },
];
export const FURN_COLORS = [0xffb3c8, 0x8fd3ff, 0xc9a7ff, 0xffd84d, 0x8fdc8f, 0xffffff, 0xc89060];

// 하루 리듬 (분)
export const DAY_MIN = 25;
export const NIGHT_MIN = 5;
