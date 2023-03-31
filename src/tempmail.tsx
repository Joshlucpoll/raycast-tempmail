import { getMailboxData, newAuth, Preferences, downloadMessage } from "../lib/main";
import {
  Action,
  ActionPanel,
  openCommandPreferences,
  open,
  List,
  Icon,
  Alert,
  confirmAlert,
  getPreferenceValues,
  showToast,
  Toast,
  Color,
  showInFinder,
} from "@raycast/api";
import Message from "./message";
import { useCachedPromise, getAvatarIcon } from "@raycast/utils";
import { useEffect, useState, useRef } from "react";
import moment from "moment";

// Returns the main React component for a view command
export default function Command() {
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

  const downloadEmail = async (url: string, openInMail: boolean) => {
    try {
      const emailPath = await downloadMessage(url);

      if (openInMail) open(emailPath as string);
      else showInFinder(emailPath as string);
    } catch (e) {
      if (e.message == "Token Expired") revalidate();
      else
        showToast({
          style: Toast.Style.Failure,
          title: "Something went wrong",
          message: e.message,
        });
    }
  };

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
        {isLoading && (
          <List.Item
            icon={{ source: Icon.CircleProgress }}
            title="Loading Messages"
            subtitle="Retrieving messages from server"
          />
        )}
        {!isLoading &&
          data &&
          data.messages.map((message) => (
            <List.Item
              key={message.id}
              id={message.id}
              icon={getAvatarIcon(message.from.name)}
              title={message.from.name}
              accessories={[
                {
                  tag: { value: message.subject, color: Color.Blue },
                  icon: { source: Icon.BullsEye },
                  tooltip: "Subject",
                },
                { text: message.intro },
                {
                  tag: moment.duration(new Date(message.createdAt).getTime() - new Date().getTime()).humanize(true),
                  tooltip: "Received",
                },
              ]}
              actions={
                <ActionPanel>
                  <Action.Push title="View Email" icon={{ source: Icon.Eye }} target={<Message id={message.id} />} />
                  <Action
                    title="View in Mail App"
                    icon={{ source: Icon.AppWindow }}
                    onAction={() => downloadEmail(message.downloadUrl, true)}
                  />
                  <Action
                    title="Download Email"
                    icon={{ source: Icon.Download }}
                    onAction={() => downloadEmail(message.downloadUrl, false)}
                  />
                </ActionPanel>
              }
            />
          ))}
        {data?.messages?.length == 0 && (
          <List.Item
            icon={{ source: Icon.Ellipsis, tintColor: Color.SecondaryText }}
            title={"Inbox Empty"}
            subtitle="Messages will automatically appear here"
          />
        )}
      </List.Section>
    </List>
  );
}
