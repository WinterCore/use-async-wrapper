import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.tsx"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
};

export default config;
