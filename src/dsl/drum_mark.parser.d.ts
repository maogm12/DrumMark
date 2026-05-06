export const parser: {
  configure(options: { strict: boolean }): {
    parse(source: string): {
      cursor(): {
        next(): boolean;
        name: string;
        from: number;
        to: number;
      };
    };
  };
};
