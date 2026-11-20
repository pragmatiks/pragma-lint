/**
 * The import and property bans of the Next config, kept free of the Next config's peers so the unit-test config can compose them.
 *
 * @packageDocumentation
 */
const FORWARD_REF_MESSAGE =
  "Pass ref as a prop; React 19 does not need forwardRef.";
const ICON_FAMILY = "@phosphor-icons/react";
const ICON_PACKAGES = [
  "lucide-react",
  "react-icons",
  "react-icons/*",
  "@heroicons/*",
  "@tabler/icons-react",
  "@radix-ui/react-icons",
  "react-feather",
  "@fortawesome/*",
  "@mui/icons-material",
  "@mui/icons-material/*",
];

/**
 * The `no-restricted-imports` options of the Next config.
 */
export const NEXT_RESTRICTED_IMPORTS = {
  paths: [
    {
      name: "react",
      importNames: ["forwardRef"],
      message: FORWARD_REF_MESSAGE,
    },
  ],
  patterns: [
    {
      group: ICON_PACKAGES,
      message: `Use ${ICON_FAMILY}, the project's one icon family.`,
    },
  ],
};

/**
 * The `no-restricted-properties` entry of the Next config.
 */
export const NEXT_RESTRICTED_PROPERTIES = {
  object: "React",
  property: "forwardRef",
  message: FORWARD_REF_MESSAGE,
};
