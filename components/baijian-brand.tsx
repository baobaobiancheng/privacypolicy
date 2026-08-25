import Link from "next/link";

type BaijianBrandProps = {
  compact?: boolean;
  href?: string;
};

export function BaijianBrand({ compact = false, href = "/" }: BaijianBrandProps) {
  return (
    <Link className="baijian-brand" href={href} aria-label="返回百鉴隐私政策首页">
      <img src="/baijian-logo.png" alt="" width="32" height="32" />
      <strong>百鉴</strong>
      {!compact ? <><span aria-hidden="true" /><em>隐私政策</em></> : null}
    </Link>
  );
}
