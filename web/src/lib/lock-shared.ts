// ロック画面とメイン画面の両方 (クライアント) から使う値。秘密情報は含めない。

/** PIN の桁数 (入力欄の表示用)。PIN を変更して桁数が変わる場合は NEXT_PUBLIC_PIN_LENGTH を設定する */
export const PIN_LENGTH = Number(process.env.NEXT_PUBLIC_PIN_LENGTH) || 15;

/** 解錠直後の再読み込みで、メイン画面に「光の中から現れる」演出を出すための目印 */
export const UNLOCK_FLAG = "meikan:unlocked";
