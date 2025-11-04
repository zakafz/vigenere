import LayoutShell from "./layout-shell";

export default function Layout({ children }: any) {
  return (
    <>
      <LayoutShell>{children}</LayoutShell>
    </>
  );
}
