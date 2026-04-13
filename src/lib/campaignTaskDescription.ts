const CAMPAIGN_MARKER = "━━━ Orientações da Campanha (não editável) ━━━";
const CAMPAIGN_TAG_REGEX = /\n*\[Campanha: .+?\]\s*$/;

export interface CampaignTaskDescriptionParts {
  editableDescription: string;
  instructions: string;
  campaignName: string | null;
}

export const parseCampaignTaskDescription = (
  description?: string | null,
): CampaignTaskDescriptionParts => {
  const fullDescription = description || "";
  const markerIndex = fullDescription.indexOf(CAMPAIGN_MARKER);
  const campaignName = fullDescription.match(/\[Campanha: (.+?)\]/)?.[1] ?? null;

  if (markerIndex === -1) {
    return {
      editableDescription: fullDescription.replace(CAMPAIGN_TAG_REGEX, "").trim(),
      instructions: "",
      campaignName,
    };
  }

  const separatorIndex = fullDescription.lastIndexOf("\n\n", markerIndex);
  const editableDescription = fullDescription
    .substring(0, separatorIndex > -1 ? separatorIndex : markerIndex)
    .trim();

  const instructions = fullDescription
    .substring(markerIndex + CAMPAIGN_MARKER.length)
    .replace(CAMPAIGN_TAG_REGEX, "")
    .trim();

  return {
    editableDescription,
    instructions,
    campaignName,
  };
};

export const buildCampaignTaskDescription = (
  editableDescription: string,
  originalDescription?: string | null,
) => {
  const original = originalDescription || "";
  const markerIndex = original.indexOf(CAMPAIGN_MARKER);
  const campaignTagMatch = original.match(/\n*(\[Campanha: .+?\])\s*$/);

  let preservedMetadata = "";

  if (markerIndex > -1) {
    const separatorIndex = original.lastIndexOf("\n\n", markerIndex);
    preservedMetadata = original.substring(separatorIndex > -1 ? separatorIndex + 2 : markerIndex).trim();
  } else if (campaignTagMatch) {
    preservedMetadata = campaignTagMatch[1];
  }

  const cleanDescription = editableDescription.trim();

  if (!preservedMetadata) {
    return cleanDescription || null;
  }

  return cleanDescription
    ? `${cleanDescription}\n\n${preservedMetadata}`
    : preservedMetadata;
};
