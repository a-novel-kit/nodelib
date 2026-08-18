<script lang="ts">
  import type { TFunction } from "i18next";

  type Perspective = "creator" | "reader";

  interface Props {
    count?: number;
    perspective?: Perspective;
    t: TFunction<"common">;
  }

  let { count = 2, perspective = "creator", t }: Props = $props();

  const perspectiveLabel = $derived(
    perspective === "creator"
      ? t("fixture.perspective", { context: "creator" })
      : t("fixture.perspective", { context: "reader" })
  );
  const collaboratorsLabel = $derived(
    perspective === "creator"
      ? t("fixture.collaborators", { context: "creator", count })
      : t("fixture.collaborators", { context: "reader", count })
  );
</script>

<p>{t("fixture.ready")}</p>
<p>{t("fixture.items", { count })}</p>
<p>{perspectiveLabel}</p>
<p>{collaboratorsLabel}</p>
