// Types globais do projeto Tappo
declare type LayoutProps<T extends string = string> = {
  children: React.ReactNode;
  params?: Promise<Record<string, string>>;
};
