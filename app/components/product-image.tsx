import Image, { type ImageProps } from "next/image";

/**
 * 정적 상품 이미지용 래퍼.
 *
 * vinext 는 `next.config.ts` 의 `images.unoptimized` 를 무시하므로,
 * 그냥 `next/image` 를 쓰면 정적 상품컷도 `/_vinext/image` 최적화
 * 엔드포인트를 경유한다. 그 엔드포인트는 `IMAGES` 바인딩이 없으면
 * 실패하고, 있어도 서버리스에서 원본 대비 이득이 불확실하다.
 *
 * 여기서 `unoptimized` 를 기본값으로 박아, 원본을 그대로 서빙한다.
 */
export function ProductImage(props: ImageProps) {
  // alt 는 ImageProps 로 이미 강제된다. 래퍼 정의에는 정적 alt 가 없어
  // jsx-a11y 가 여기서만 오탐하므로 이 줄에서만 규칙을 끈다.
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image {...props} unoptimized />;
}
