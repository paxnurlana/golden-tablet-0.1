import { lazy, Suspense, type ComponentType } from "react";
export default function dynamic(
  loader: () => Promise<any>,
  options?: { loading?: ComponentType; ssr?: boolean },
) {
  const Component = lazy(async () => {
    const loaded = await loader();
    return { default: loaded.default ?? loaded };
  });
  return function Dynamic(props: any) {
    const Loading = options?.loading;
    return (
      <Suspense fallback={Loading ? <Loading /> : null}>
        <Component {...props} />
      </Suspense>
    );
  };
}
