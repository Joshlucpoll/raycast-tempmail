import { getMessage, getMailboxData, newAuth, Preferences } from "../lib/main";
import {
  Action,
  ActionPanel,
  openCommandPreferences,
  List,
  Icon,
  Alert,
  confirmAlert,
  getPreferenceValues,
  showToast,
  Toast,
  Color,
} from "@raycast/api";
import { useCachedPromise, usePromise, getAvatarIcon } from "@raycast/utils";
import { useEffect, useState, useRef } from "react";
import moment from "moment";
import TurndownService from "turndown";

function Message({ id }) {
  const turndownService = new TurndownService({ headingStyle: "atx" });

  const abortable = useRef<AbortController>();
  const { isLoading, data, revalidate } = usePromise(getMessage, [id], {
    abortable,
    onError: (e) => {
      if (e.message == "Token Expired") revalidate();
      else throw e;
    },
    onData: (data) => {
      // console.log(data.html[0]);
      // console.log(data.html.indexOf("body"));
      console.log(data.html[0].slice(data.html[0].indexOf("<body"), data.html[0].indexOf("</body>") + 7));
      // console.log(
      //   turndownService.turndown(
      //     '<body dir="ltr"><h1>Hey there</h1><div>Minim aliquip fugiat esse laboris ipsum ullamco aute amet voluptate. Laboris ipsum aliquip deserunt ex exercitation sunt Lorem est reprehenderit. Voluptate eiusmod ut consequat velit. Sunt proident ea ea duis nostrud nulla. Velit elit ipsum exercitation velit aliquip tempor veniam voluptate id esse aute laborum. Tempor ad ea eiusmod exercitation qui veniam laboris anim quis.</div><div class="elementToProof" style="font-family: Calibri, Arial, Helvetica, sans-serif; font-size: 12pt; color: rgb(0, 0, 0); background-color: rgb(255, 255, 255);"><br></div><div class="elementToProof ContentPasted0" style="font-family: Calibri, Arial, Helvetica, sans-serif; font-size: 12pt; color: rgb(0, 0, 0); background-color: rgb(255, 255, 255);">'
      //   )
      // );
    },
  });

  return (
    <List isShowingDetail>
      {!isLoading && (
        <>
          <List.Item
            title="Body"
            detail={
              <List.Item.Detail
                markdown={turndownService.turndown(
                  data.html[0].slice(data.html[0].indexOf("<body"), data.html[0].indexOf("</body>") + 7)
                )}
              />
            }
          />
          <List.Item
            title="Subject"
            subtitle={data.subject}
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
                    <List.Item.Detail.Metadata.Separator />
                    {data.cc.map((cc, i) => (
                      <List.Item.Detail.Metadata.Label
                        key={cc.address}
                        title={i == 0 ? "Cc" : ""}
                        text={`${cc.name} <${cc.address}>`}
                      />
                    ))}
                    <List.Item.Detail.Metadata.Separator />
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
                  </List.Item.Detail.Metadata>
                }
              />
            }
          />
        </>
      )}
    </List>
  );
}

// Returns the main React component for a view command
export default function Commad() {
  const expiry_time = parseInt(getPreferenceValues<Preferences>().expiry_time);
  const [expiresIn, setExpiresIn] = useState<string>();

  const abortable = useRef<AbortController>();
  const { isLoading, data, revalidate } = useCachedPromise(getMailboxData, [], {
    abortable,
    keepPreviousData: true,
    onError: (e) => {
      if (e.message == "Token Expired") revalidate();
      else
        showToast({
          style: Toast.Style.Failure,
          title: "Something went wrong",
          message: e.message,
        });
    },
  });

  useEffect(() => {
    if (isNaN(expiry_time)) {
      setExpiresIn("Never");
    } else {
      const updateTime = setInterval(() => {
        setExpiresIn(
          "in " +
            moment
              .duration(expiry_time * 60000 - (new Date().getTime() - new Date(data.lastActive).getTime()))
              .humanize()
        );
      }, 1000);
      return () => clearInterval(updateTime);
    }
  }, [data]);

  // useEffect(() => {
  //   const updateTime = setInterval(() => {
  //     revalidate();
  //   }, 10000);
  //   return () => clearInterval(updateTime);
  // }, []);

  const generateNewAddress = async () => {
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Generating new email",
    });

    await newAuth();
    revalidate();

    toast.style = Toast.Style.Success;
    toast.title = "Generated new email";
  };

  const options: Alert.Options = {
    title: "Generate a New Email Address",
    message: "All your current messages will be lost",
    primaryAction: {
      title: "Generate",
      style: Alert.ActionStyle.Default,
      onAction: generateNewAddress,
    },
    dismissAction: {
      title: "Cancel",
      style: Alert.ActionStyle.Cancel,
    },
  };

  return (
    <List
      filtering={false}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action title="Open Extension Preferences" onAction={openCommandPreferences} />
        </ActionPanel>
      }
    >
      <List.Section title="Current Address">
        {isLoading && !data && <List.Item icon={{ source: Icon.CircleProgress }} title="Fetching address" />}
        {data && (
          <>
            <List.Item
              title={data.currentAddress}
              icon={{ source: Icon.Envelope }}
              accessories={[{ tag: expiresIn ? `Expires ${expiresIn}` : "" }]}
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard title="Copy Email Address to Clipboard" content={data.currentAddress} />
                </ActionPanel>
              }
            />
            <List.Item
              title="Generate a New Email"
              icon={{ source: Icon.PlusCircle }}
              actions={
                <ActionPanel>
                  <Action
                    title="Generate a New Email"
                    icon={{ source: Icon.CheckCircle }}
                    onAction={() => confirmAlert(options)}
                  ></Action>
                  <ActionPanel.Submenu title="Generate a New Email"></ActionPanel.Submenu>
                </ActionPanel>
              }
            />
          </>
        )}
      </List.Section>
      <List.Section title="Messages Received">
        {!isLoading &&
          data &&
          data.messages.map((message) => (
            <List.Item
              key={message.id}
              id={message.id}
              icon={getAvatarIcon(message.from.name)}
              title={message.from.name}
              // subtitle={message.intro}
              accessories={[
                {
                  tag: { value: message.subject, color: Color.Blue },
                  icon: { source: Icon.BullsEye },
                  tooltip: "Subject",
                },
                { text: message.intro },
                {
                  text: {
                    value: moment.duration(new Date(message.createdAt).getTime() - new Date().getTime()).humanize(true),
                    color: Color.PrimaryText,
                  },
                  tooltip: "Received",
                },
              ]}
              actions={
                <ActionPanel>
                  <Action.Push title="View Email" target={<Message id={message.id} />} />
                  {/* <Action title="Download Email" onAction={() => axios.}={`https://api.mail.tm${message.downloadUrl}`} /> */}
                </ActionPanel>
              }
            />
          ))}
        {data?.messages?.length == 0 && (
          <List.Item
            icon={{ source: Icon.Ellipsis }}
            title="Inbox Empty"
            subtitle="Messages will automatically appear here"
          />
        )}
      </List.Section>
    </List>
  );
}
