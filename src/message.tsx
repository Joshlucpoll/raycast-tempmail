import TurndownService from "turndown";
import { getMessage } from "../lib/main";
import { useRef } from "react";
import { useCachedPromise } from "@raycast/utils";
import { Action, ActionPanel, List, Icon, Detail, Color } from "@raycast/api";
import moment from "moment";

function fullscreenDetails(data): React.ReactNode {
  return (
    <List>
      <List.Section title="Received">
        <List.Item
          title={moment(data.createdAt).format("dddd, MMMM Do YYYY, h:mm:ss a")}
          accessories={[
            {
              tag: {
                value: moment.duration(new Date(data.createdAt).getTime() - new Date().getTime()).humanize(true),
                color: Color.Orange,
              },
              icon: { source: Icon.Clock },
            },
          ]}
        ></List.Item>
      </List.Section>
      <List.Section title="From">
        <List.Item
          title={data.from.address}
          subtitle={data.from.name}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard
                title="Copy Email"
                icon={{ source: Icon.Envelope }}
                content={data.from.address}
              ></Action.CopyToClipboard>
              {data.from.name && (
                <Action.CopyToClipboard
                  title="Copy Name"
                  icon={{ source: Icon.PersonCircle }}
                  content={data.from.name}
                ></Action.CopyToClipboard>
              )}
            </ActionPanel>
          }
        ></List.Item>
      </List.Section>
      <List.Section title="To">
        {data.to.map((to) => (
          <List.Item
            key={to.address}
            title={to.address}
            subtitle={to.name}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard
                  title="Copy Email"
                  icon={{ source: Icon.Envelope }}
                  content={to.address}
                ></Action.CopyToClipboard>
                {to.name && (
                  <Action.CopyToClipboard
                    title="Copy Name"
                    icon={{ source: Icon.PersonCircle }}
                    content={to.name}
                  ></Action.CopyToClipboard>
                )}
              </ActionPanel>
            }
          ></List.Item>
        ))}
      </List.Section>
      <List.Section title="Cc">
        {data.cc.map((cc) => (
          <List.Item
            key={cc.address}
            title={cc.address}
            subtitle={cc.name}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard
                  title="Copy Email"
                  icon={{ source: Icon.Envelope }}
                  content={cc.address}
                ></Action.CopyToClipboard>
                {cc.name && (
                  <Action.CopyToClipboard
                    title="Copy Name"
                    icon={{ source: Icon.PersonCircle }}
                    content={cc.name}
                  ></Action.CopyToClipboard>
                )}
              </ActionPanel>
            }
          ></List.Item>
        ))}
      </List.Section>
      <List.Section title="Bcc">
        {data.bcc.map((bcc) => (
          <List.Item
            key={bcc.address}
            title={bcc.address}
            subtitle={bcc.name}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard
                  title="Copy Email"
                  icon={{ source: Icon.Envelope }}
                  content={bcc.address}
                ></Action.CopyToClipboard>
                {bcc.name && (
                  <Action.CopyToClipboard
                    title="Copy Name"
                    icon={{ source: Icon.PersonCircle }}
                    content={bcc.name}
                  ></Action.CopyToClipboard>
                )}
              </ActionPanel>
            }
          ></List.Item>
        ))}
      </List.Section>
    </List>
  );
}

export default function Message({ id }) {
  const turndownService = new TurndownService({ headingStyle: "atx" });

  const abortable = useRef<AbortController>();
  const { isLoading, data, revalidate } = useCachedPromise(getMessage, [id], {
    abortable,
    onError: (e) => {
      if (e.message == "Token Expired") revalidate();
      else throw e;
    },
  });

  console.log({ ...data, html: null });
  console.log(data.attachments);

  const bodyHTML = data?.html[0].includes("<body")
    ? data?.html[0].slice(data.html[0].indexOf("<body"), data?.html[0].indexOf("</body>") + 7)
    : data?.html[0];

  const bodyMarkdown = `# ${data?.subject ?? ""}\n---\n&nbsp;${turndownService.turndown(bodyHTML ?? "")}`;

  return (
    <List isShowingDetail filtering={false} isLoading={isLoading}>
      {isLoading && (
        <List.Item
          icon={{ source: Icon.CircleProgress }}
          title="Loading Message"
          subtitle="Retrieving message from server"
        />
      )}
      {!isLoading && (
        <>
          <List.Item
            title="Email"
            detail={<List.Item.Detail markdown={bodyMarkdown} />}
            actions={
              <ActionPanel>
                <Action.Push title="View Fullscreen" target={<Detail markdown={bodyMarkdown}></Detail>}></Action.Push>
              </ActionPanel>
            }
            accessories={[
              {
                tag: { value: data.subject, color: Color.Blue },
                icon: { source: Icon.BullsEye },
                tooltip: "Subject",
              },
            ]}
          />
          <List.Item
            title="Details"
            accessories={[
              {
                text: moment.duration(new Date(data.createdAt).getTime() - new Date().getTime()).humanize(true),
                tooltip: "From",
              },
            ]}
            detail={
              <List.Item.Detail
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="From" text={`${data.from.name} <${data.from.address}>`} />
                    <List.Item.Detail.Metadata.Separator />
                    {data.to.map((to, i) => (
                      <List.Item.Detail.Metadata.Label
                        key={to.address}
                        title={i == 0 ? "To" : ""}
                        text={`${to.name} <${to.address}>`}
                      />
                    ))}
                    {data.cc.length != 0 && <List.Item.Detail.Metadata.Separator />}
                    {data.cc.map((cc, i) => (
                      <List.Item.Detail.Metadata.Label
                        key={cc.address}
                        title={i == 0 ? "Cc" : ""}
                        text={`${cc.name} <${cc.address}>`}
                      />
                    ))}
                    {data.bcc.length != 0 && <List.Item.Detail.Metadata.Separator />}
                    {data.bcc.map((bcc, i) => (
                      <List.Item.Detail.Metadata.Label
                        key={bcc.address}
                        title={i == 0 ? "Bcc" : ""}
                        text={`${bcc.name} <${bcc.address}>`}
                      />
                    ))}
                    <List.Item.Detail.Metadata.Label title="" />
                    <List.Item.Detail.Metadata.Label
                      title="Received"
                      text={moment(data.createdAt).format("dddd, MMMM Do YYYY, h:mm:ss a")}
                    />
                    <List.Item.Detail.Metadata.Separator />
                    <List.Item.Detail.Metadata.Label
                      title="Auto Deleted"
                      text={moment
                        .duration(new Date(data.retentionDate).getTime() - new Date().getTime())
                        .humanize(true)}
                    />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={
              <ActionPanel>
                <Action.Push title="View Fullscreen" target={fullscreenDetails(data)}></Action.Push>
              </ActionPanel>
            }
          />
        </>
      )}
      {data.hasAttachments && (
        <List.Item
          title="Attachments"
          accessories={[{ tag: { value: data.attachments.length.toString() }, icon: Icon.Paperclip }]}
          detail={
            <List.Item.Detail
              metadata={
                <List.Item.Detail.Metadata>
                  {data.attachments.map((attachment, i) => (
                    <List.Item.Detail.Metadata.TagList key={attachment.id} title={i == 0 ? "Attachment" : ""}>
                      <List.Item.Detail.Metadata.TagList.Item
                        text={attachment.filename}
                        icon={{ source: Icon.Document }}
                      />
                      <List.Item.Detail.Metadata.TagList.Item
                        text={attachment.contentType}
                        icon={{ source: Icon.Tag }}
                        color={Color.Green}
                      />
                    </List.Item.Detail.Metadata.TagList>
                  ))}
                </List.Item.Detail.Metadata>
              }
            />
          }
        ></List.Item>
      )}
    </List>
  );
}
